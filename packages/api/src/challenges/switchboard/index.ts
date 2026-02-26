import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { SWITCHBOARD_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateSwitchboardData } from "./data.js";
import { scoreSwitchboard } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateSwitchboardData } from "./data.js";
export { scoreSwitchboard } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateSwitchboardData(match.seed);
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

export const switchboardModule: ChallengeModule = {
  slug: "switchboard",
  dimensions: SWITCHBOARD_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateSwitchboardData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      census: data.census,
      hospital: data.hospital,
      school: data.school,
      business: data.business,
      questions: data.questions,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreSwitchboard(input);
  },

  sandboxApiNames(): string[] {
    return ["census", "hospital", "school", "business", "questions"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/census — all census records, or filter by district
    sandbox.get("/:matchId/census", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The switchboard is silent.");
      }
      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/census`, 200, startTime);

      const district = c.req.query("district");
      if (district) {
        const record = result.data.census.find(
          (r) => r.district.toLowerCase() === district.toLowerCase(),
        );
        if (!record) {
          return c.json({ error: "District not found in census data", available: result.data.census.map((r) => r.district) }, 404);
        }
        return c.json(record);
      }
      return c.json({ records: result.data.census, total: result.data.census.length });
    });

    // GET /:matchId/hospital — all hospital records, or filter by district
    sandbox.get("/:matchId/hospital", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The switchboard is silent.");
      }
      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/hospital`, 200, startTime);

      const district = c.req.query("district");
      if (district) {
        const record = result.data.hospital.find(
          (r) => r.district.toLowerCase() === district.toLowerCase(),
        );
        if (!record) {
          return c.json({ error: "District not found in hospital data", available: result.data.hospital.map((r) => r.district) }, 404);
        }
        return c.json(record);
      }
      return c.json({ records: result.data.hospital, total: result.data.hospital.length });
    });

    // GET /:matchId/school — all school records, or filter by district
    sandbox.get("/:matchId/school", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The switchboard is silent.");
      }
      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/school`, 200, startTime);

      const district = c.req.query("district");
      if (district) {
        const record = result.data.school.find(
          (r) => r.district.toLowerCase() === district.toLowerCase(),
        );
        if (!record) {
          return c.json({ error: "District not found in school data", available: result.data.school.map((r) => r.district) }, 404);
        }
        return c.json(record);
      }
      return c.json({ records: result.data.school, total: result.data.school.length });
    });

    // GET /:matchId/business — all business records, or filter by district
    sandbox.get("/:matchId/business", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The switchboard is silent.");
      }
      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/business`, 200, startTime);

      const district = c.req.query("district");
      if (district) {
        const record = result.data.business.find(
          (r) => r.district.toLowerCase() === district.toLowerCase(),
        );
        if (!record) {
          return c.json({ error: "District not found in business data", available: result.data.business.map((r) => r.district) }, 404);
        }
        return c.json(record);
      }
      return c.json({ records: result.data.business, total: result.data.business.length });
    });

    // GET /:matchId/questions — returns the 5 questions (no ground truth)
    sandbox.get("/:matchId/questions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The switchboard is silent.");
      }
      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/questions`, 200, startTime);

      return c.json({
        questions: result.data.questions,
        total: result.data.questions.length,
      });
    });

    return sandbox;
  },
};
