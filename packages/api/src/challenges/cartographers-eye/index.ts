import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { CARTOGRAPHERS_EYE_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateCartographerData } from "./data.js";
import { scoreCartographer } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateCartographerData } from "./data.js";
export { scoreCartographer } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateCartographerData(match.seed);
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

export const cartographersEyeModule: ChallengeModule = {
  slug: "cartographers-eye",
  dimensions: CARTOGRAPHERS_EYE_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateCartographerData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      svg_map: data.svg_map,
      questions: data.questions,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreCartographer(input);
  },

  sandboxApiNames(): string[] {
    return ["maps", "legend", "questions"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/maps — returns the SVG map
    sandbox.get("/:matchId/maps", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The cartographer's charts have faded.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/maps`, 200, startTime);

      return c.json({
        svg_map: result.data.svg_map,
        canvas: { width: 1000, height: 800 },
        instructions: "Parse the SVG to identify region positions, sizes, and trade routes. Coordinates are in map units.",
      });
    });

    // GET /:matchId/legend — returns region names and types (NO coordinates)
    sandbox.get("/:matchId/legend", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The cartographer's charts have faded.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/legend`, 200, startTime);

      // Expose region names and types but NOT coordinates
      const legend = result.data.regions.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      }));

      const routeDescriptions = result.data.routes.map((rt) => {
        const from = result.data.regions.find((r) => r.id === rt.from_region)!;
        const to = result.data.regions.find((r) => r.id === rt.to_region)!;
        return {
          id: rt.id,
          from: from.name,
          to: to.name,
        };
      });

      return c.json({
        regions: legend,
        routes: routeDescriptions,
        total_regions: legend.length,
        total_routes: routeDescriptions.length,
      });
    });

    // GET /:matchId/questions — returns the 5 spatial reasoning questions
    sandbox.get("/:matchId/questions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The cartographer's charts have faded.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/questions`, 200, startTime);

      return c.json({
        questions: result.data.questions,
        total: result.data.questions.length,
        instructions: "Answer each question by submitting { [question_id]: answer }. Include optional 'reasoning' or 'calculations' objects for spatial reasoning credit.",
      });
    });

    return sandbox;
  },
};
