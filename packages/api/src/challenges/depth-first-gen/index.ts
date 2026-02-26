import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { DEPTH_FIRST_GEN_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateDepthFirstData } from "./data.js";
import { scoreDepthFirst } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateDepthFirstData } from "./data.js";
export { scoreDepthFirst } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateDepthFirstData(match.seed);
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

export const depthFirstGenModule: ChallengeModule = {
  slug: "depth-first-gen",
  dimensions: DEPTH_FIRST_GEN_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateDepthFirstData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      spec: data.spec,
      test_inputs: data.test_inputs,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreDepthFirst(input);
  },

  sandboxApiNames(): string[] {
    return ["spec", "examples", "test-inputs"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/spec — returns the task spec with description and examples
    sandbox.get("/:matchId/spec", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The depths yield nothing to ghosts.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/spec`, 200, startTime);

      return c.json({
        task_type: result.data.spec.task_type,
        description: result.data.spec.description,
        examples: result.data.spec.examples,
        total_test_cases: result.data.test_inputs.length,
      });
    });

    // GET /:matchId/examples — returns just the 3 examples
    sandbox.get("/:matchId/examples", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The depths yield nothing to ghosts.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/examples`, 200, startTime);

      return c.json({
        examples: result.data.spec.examples,
        total: result.data.spec.examples.length,
      });
    });

    // GET /:matchId/test-inputs — returns all 20 test inputs (without outputs)
    sandbox.get("/:matchId/test-inputs", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The depths yield nothing to ghosts.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/test-inputs`, 200, startTime);

      return c.json({
        test_inputs: result.data.test_inputs,
        total: result.data.test_inputs.length,
        instructions: "Apply the transformation described in the spec to each input. Submit as { [test_id]: output }.",
      });
    });

    return sandbox;
  },
};
