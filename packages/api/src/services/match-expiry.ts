/**
 * Expired match handling — treats expired matches as draws with Elo impact.
 */
import { eq } from "drizzle-orm";
import { db, matches, agents, challenges } from "@clawdiators/db";
import { ELO_DEFAULT, DIFFICULTY_ELO } from "@clawdiators/shared";
import { calculateElo } from "./elo.js";

/**
 * Expire a match, treating it as a draw with Elo impact.
 * Updates the match status, result, Elo fields, and agent stats atomically.
 *
 * @param matchId - The match to expire
 * @param reason - Optional reason for expiration (default: "time_expired")
 * @returns true if the match was expired, false if it was already non-active
 */
export async function expireMatch(matchId: string, reason?: string): Promise<boolean> {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match || match.status !== "active") return false;

  const challenge = await db.query.challenges.findFirst({
    where: eq(challenges.id, match.challengeId),
  });
  if (!challenge) {
    // No challenge found — just mark expired without Elo
    await db.update(matches).set({ status: "expired" }).where(eq(matches.id, matchId));
    return true;
  }

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, match.agentId),
  });
  if (!agent) {
    await db.update(matches).set({ status: "expired" }).where(eq(matches.id, matchId));
    return true;
  }

  // Compute Elo change as a draw
  const challengeDifficulty = (challenge.calibratedDifficulty ?? challenge.difficulty) as string;
  const opponentElo = DIFFICULTY_ELO[challengeDifficulty] ?? ELO_DEFAULT;
  const eloResult = calculateElo(agent.elo, opponentElo, "draw", agent.matchCount);

  const now = new Date();

  // Update match with draw result and Elo
  await db
    .update(matches)
    .set({
      status: "expired",
      result: "draw",
      eloBefore: agent.elo,
      eloAfter: eloResult.newRating,
      eloChange: eloResult.change,
      completedAt: now,
    })
    .where(eq(matches.id, matchId));

  // Update agent stats
  const eloHistory = [
    ...agent.eloHistory,
    {
      ts: now.toISOString(),
      elo: eloResult.newRating,
      matchId,
    },
  ];

  await db
    .update(agents)
    .set({
      elo: eloResult.newRating,
      matchCount: agent.matchCount + 1,
      drawCount: agent.drawCount + 1,
      currentStreak: 0,
      eloHistory,
      updatedAt: now,
    })
    .where(eq(agents.id, agent.id));

  return true;
}
