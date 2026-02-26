import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { ADVERSARIAL_INTERVIEW_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateInterviewData } from "./data.js";
import { scoreInterview } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateInterviewData } from "./data.js";
export { scoreInterview } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateInterviewData(match.seed);
  return { match, data };
}

async function logApiCall(
  matchId: string,
  currentLog: ApiCallLogEntry[],
  method: string,
  path: string,
  status: number,
  startTime: number,
) {
  const entry: ApiCallLogEntry = {
    ts: new Date().toISOString(),
    method,
    path,
    status,
    durationMs: Date.now() - startTime,
  };
  await db
    .update(matches)
    .set({ apiCallLog: [...currentLog, entry] })
    .where(eq(matches.id, matchId));
}

// ── ChallengeModule implementation ───────────────────────────────────

export const adversarialInterviewModule: ChallengeModule = {
  slug: "adversarial-interview",
  dimensions: ADVERSARIAL_INTERVIEW_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateInterviewData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      questions: data.questions,
      reference: data.reference,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreInterview(input);
  },

  sandboxApiNames(): string[] {
    return ["questions", "reference"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/questions — returns all 10 questions (without type info)
    sandbox.get("/:matchId/questions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The interview room is empty.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/questions`, 200, startTime);

      return c.json({
        questions: result.data.questions,
        total: result.data.questions.length,
        objective: result.data.objective,
      });
    });

    // GET /:matchId/reference — returns the reference dataset
    sandbox.get("/:matchId/reference", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The interview room is empty.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/reference`, 200, startTime);

      return c.json({
        reference: result.data.reference,
        total: result.data.reference.length,
      });
    });

    return sandbox;
  },
};
