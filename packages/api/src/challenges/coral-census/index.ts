import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { CORAL_CENSUS_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateCensusData } from "./data.js";
import { scoreCensus } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateCensusData } from "./data.js";
export { scoreCensus } from "./scorer.js";

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!match || match.status !== "active" || new Date() > match.expiresAt) return null;
  const data = generateCensusData(match.seed);
  return { match, data };
}

async function logApiCall(matchId: string, currentLog: ApiCallLogEntry[], method: string, path: string, status: number, startTime: number) {
  const entry: ApiCallLogEntry = { ts: new Date().toISOString(), method, path, status, durationMs: Date.now() - startTime };
  await db.update(matches).set({ apiCallLog: [...currentLog, entry] }).where(eq(matches.id, matchId));
}

export const coralCensusModule: ChallengeModule = {
  slug: "coral-census",
  dimensions: CORAL_CENSUS_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateCensusData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      regions: data.regions,
      batches: data.batches,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreCensus(input);
  },

  sandboxApiNames(): string[] {
    return ["regions", "events"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/regions — returns all 6 regions with initial populations
    sandbox.get("/:matchId/regions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) return errorEnvelope(c, "Match not found or expired", 404);
      await logApiCall(matchId, result.match.apiCallLog, "GET", `/sandbox/${matchId}/regions`, 200, startTime);

      return c.json({
        regions: result.data.regions,
        total: result.data.regions.length,
      });
    });

    // GET /:matchId/events?batch=N — returns batch N events (1-indexed)
    // Batch 1 always available; batch N+1 requires N checkpoints
    sandbox.get("/:matchId/events", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) return errorEnvelope(c, "Match not found or expired", 404);

      const batchParam = c.req.query("batch");
      const batchNum = Number(batchParam || "1");

      if (batchNum < 1 || batchNum > 5 || !Number.isInteger(batchNum)) {
        await logApiCall(matchId, result.match.apiCallLog, "GET", `/sandbox/${matchId}/events?batch=${batchParam}`, 400, startTime);
        return errorEnvelope(c, "Batch must be an integer between 1 and 5", 400);
      }

      // Gate check: batch N+1 requires N checkpoints
      if (batchNum > 1) {
        const requiredCheckpoints = batchNum - 1;
        if (result.match.checkpoints.length < requiredCheckpoints) {
          await logApiCall(matchId, result.match.apiCallLog, "GET", `/sandbox/${matchId}/events?batch=${batchNum}`, 403, startTime);
          return errorEnvelope(
            c,
            `Submit checkpoint for batch ${requiredCheckpoints} first`,
            403,
            `Batch ${batchNum} is locked until you submit ${requiredCheckpoints} checkpoint${requiredCheckpoints > 1 ? "s" : ""}.`,
          );
        }
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET", `/sandbox/${matchId}/events?batch=${batchNum}`, 200, startTime);

      const events = result.data.batches[batchNum - 1];
      return c.json({
        batch: batchNum,
        events,
        total: events.length,
        batches_remaining: 5 - batchNum,
      });
    });

    return sandbox;
  },
};
