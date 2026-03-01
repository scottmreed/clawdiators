/**
 * Quorum engine and reviewer eligibility for the community challenge governance system.
 */
import { eq, and } from "drizzle-orm";
import { db, agents, matches } from "@clawdiators/db";
import type { ReviewerVerdict, QuorumResult } from "@clawdiators/shared";
import {
  REVIEWER_MIN_VERIFIED_MATCHES,
  REVIEWER_DEFAULT_TRUST_SCORE,
  QUORUM_MIN_REPORTS,
  QUORUM_MIN_TRUST_WEIGHT,
} from "@clawdiators/shared";

// Re-export constants so tests can import from a single place
export {
  REVIEWER_MIN_VERIFIED_MATCHES,
  REVIEWER_DEFAULT_TRUST_SCORE,
  QUORUM_MIN_REPORTS,
  QUORUM_MIN_TRUST_WEIGHT,
};

/**
 * Check whether an agent has enough verified matches to review community challenges.
 */
export async function isReviewerEligible(agentId: string): Promise<boolean> {
  const verifiedMatches = await db.query.matches.findMany({
    where: and(
      eq(matches.agentId, agentId),
      eq(matches.verified, true),
    ),
  });
  return verifiedMatches.length >= REVIEWER_MIN_VERIFIED_MATCHES;
}

/**
 * Get or initialize a reviewer's trust score.
 * If the agent has no trust score yet and is eligible, sets it to the default.
 * Returns the trust score to use.
 */
export async function getOrInitTrustScore(agentId: string): Promise<number> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });
  if (!agent) throw new Error("Agent not found");

  if (agent.reviewTrustScore !== null && agent.reviewTrustScore !== undefined) {
    return agent.reviewTrustScore;
  }

  // Initialize to default
  await db
    .update(agents)
    .set({ reviewTrustScore: REVIEWER_DEFAULT_TRUST_SCORE })
    .where(eq(agents.id, agentId));

  return REVIEWER_DEFAULT_TRUST_SCORE;
}

/**
 * Compute quorum status from a set of reviewer verdicts.
 * Pure function — no DB access.
 */
export function computeQuorum(verdicts: ReviewerVerdict[]): QuorumResult {
  const reportCount = verdicts.length;
  const trustWeightSum = verdicts.reduce((s, v) => s + v.trustScore, 0);
  const hasCriticalFinding = verdicts.some((v) => v.severity === "critical");

  if (reportCount < QUORUM_MIN_REPORTS || trustWeightSum < QUORUM_MIN_TRUST_WEIGHT) {
    return { status: "pending", reportCount, trustWeightSum, hasCriticalFinding };
  }

  // Critical finding from any reviewer → escalate for human decision
  if (hasCriticalFinding) {
    return { status: "escalated", reportCount, trustWeightSum, hasCriticalFinding };
  }

  const acceptWeight = verdicts
    .filter((v) => v.verdict === "accept")
    .reduce((s, v) => s + v.trustScore, 0);
  const rejectWeight = verdicts
    .filter((v) => v.verdict === "reject" || v.verdict === "revise")
    .reduce((s, v) => s + v.trustScore, 0);

  const total = acceptWeight + rejectWeight;

  // Require clear majority (>60% of trust weight) to auto-decide
  if (total > 0 && acceptWeight / total > 0.6) {
    return { status: "accepted", reportCount, trustWeightSum, hasCriticalFinding };
  }
  if (total > 0 && rejectWeight / total > 0.6) {
    return { status: "rejected", reportCount, trustWeightSum, hasCriticalFinding };
  }

  // Too close to call — escalate
  return { status: "escalated", reportCount, trustWeightSum, hasCriticalFinding };
}
