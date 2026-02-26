import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { THE_MIRAGE_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateMirageData } from "./data.js";
import { scoreMirage } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateMirageData } from "./data.js";
export { scoreMirage } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateMirageData(match.seed);
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

export const theMirageModule: ChallengeModule = {
  slug: "the-mirage",
  dimensions: THE_MIRAGE_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateMirageData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      census: data.census,
      financial: data.financial,
      environmental: data.environmental,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreMirage(input);
  },

  sandboxApiNames(): string[] {
    return ["census", "financial", "environmental"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/census — all census records or filtered by district
    sandbox.get("/:matchId/census", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The mirage fades.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/census`, 200, startTime);

      const district = c.req.query("district");
      if (district) {
        const entry = result.data.census.find(
          (r) => r.district.toLowerCase() === district.toLowerCase(),
        );
        if (!entry) {
          return c.json({ error: "District not found", available: result.data.census.map((r) => r.district) }, 404);
        }
        return c.json(entry);
      }

      return c.json({ districts: result.data.census, total: result.data.census.length });
    });

    // GET /:matchId/financial — all financial records or filtered by district
    sandbox.get("/:matchId/financial", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The mirage fades.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/financial`, 200, startTime);

      const district = c.req.query("district");
      if (district) {
        const entry = result.data.financial.find(
          (r) => r.district.toLowerCase() === district.toLowerCase(),
        );
        if (!entry) {
          return c.json({ error: "District not found", available: result.data.financial.map((r) => r.district) }, 404);
        }
        return c.json(entry);
      }

      return c.json({ districts: result.data.financial, total: result.data.financial.length });
    });

    // GET /:matchId/environmental — all environmental records or filtered by district
    sandbox.get("/:matchId/environmental", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The mirage fades.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/environmental`, 200, startTime);

      const district = c.req.query("district");
      if (district) {
        const entry = result.data.environmental.find(
          (r) => r.district.toLowerCase() === district.toLowerCase(),
        );
        if (!entry) {
          return c.json({ error: "District not found", available: result.data.environmental.map((r) => r.district) }, 404);
        }
        return c.json(entry);
      }

      return c.json({ districts: result.data.environmental, total: result.data.environmental.length });
    });

    return sandbox;
  },
};
