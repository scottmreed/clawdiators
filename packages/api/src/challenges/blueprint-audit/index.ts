import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { BLUEPRINT_AUDIT_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateBlueprintData } from "./data.js";
import { scoreBlueprint } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateBlueprintData } from "./data.js";
export { scoreBlueprint } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateBlueprintData(match.seed);
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

export const blueprintAuditModule: ChallengeModule = {
  slug: "blueprint-audit",
  dimensions: BLUEPRINT_AUDIT_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateBlueprintData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      blueprints: data.blueprints.map((bp) => ({ id: bp.id, name: bp.name, floor: bp.floor })),
      rules: data.rules,
      specifications: data.specifications,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreBlueprint(input);
  },

  sandboxApiNames(): string[] {
    return ["blueprints", "building-code", "specifications"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/blueprints — returns list of blueprints (id, name, floor — NO ascii)
    sandbox.get("/:matchId/blueprints", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The blueprints have crumbled to dust.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/blueprints`, 200, startTime);

      return c.json({
        blueprints: result.data.blueprints.map((bp) => ({
          id: bp.id,
          name: bp.name,
          floor: bp.floor,
        })),
        total: result.data.blueprints.length,
      });
    });

    // GET /:matchId/blueprints/:id — returns full blueprint with ASCII art
    sandbox.get("/:matchId/blueprints/:blueprintId", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const blueprintId = c.req.param("blueprintId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The blueprints have crumbled to dust.");
      }

      const blueprint = result.data.blueprints.find((bp) => bp.id === blueprintId);
      if (!blueprint) {
        await logApiCall(matchId, result.match.apiCallLog, "GET",
          `/sandbox/${matchId}/blueprints/${blueprintId}`, 404, startTime);
        return c.json({
          error: "Blueprint not found",
          available_ids: result.data.blueprints.map((bp) => bp.id),
        }, 404);
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/blueprints/${blueprintId}`, 200, startTime);

      return c.json({
        blueprint: {
          id: blueprint.id,
          name: blueprint.name,
          floor: blueprint.floor,
          ascii: blueprint.ascii,
          legend: blueprint.legend,
        },
      });
    });

    // GET /:matchId/building-code — returns all rules
    sandbox.get("/:matchId/building-code", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The code book is sealed.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/building-code`, 200, startTime);

      return c.json({
        rules: result.data.rules,
        total: result.data.rules.length,
      });
    });

    // GET /:matchId/specifications — returns numeric specifications
    sandbox.get("/:matchId/specifications", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "Specifications unavailable.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/specifications`, 200, startTime);

      return c.json({
        specifications: result.data.specifications,
      });
    });

    return sandbox;
  },
};
