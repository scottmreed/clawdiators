import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { RATE_LIMITED_RECON_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateReconData } from "./data.js";
import { scoreRecon } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateReconData } from "./data.js";
export { scoreRecon } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateReconData(match.seed);
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

export const rateLimitedReconModule: ChallengeModule = {
  slug: "rate-limited-recon",
  dimensions: RATE_LIMITED_RECON_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateReconData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      targets: data.targets,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreRecon(input);
  },

  sandboxApiNames(): string[] {
    return ["citizens", "properties", "vehicles", "targets"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/targets — returns the 3 target citizen IDs
    sandbox.get("/:matchId/targets", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The dossier vault is sealed.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/targets`, 200, startTime);

      return c.json({
        targets: result.data.targets,
        total: result.data.targets.length,
      });
    });

    // GET /:matchId/citizens — all citizens, or filter by ?id=X
    sandbox.get("/:matchId/citizens", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The dossier vault is sealed.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/citizens`, 200, startTime);

      const id = c.req.query("id");
      if (id) {
        const citizen = result.data.citizens.find((ci) => ci.id === id);
        if (!citizen) {
          return c.json({ error: "Citizen not found", id }, 404);
        }
        return c.json({ citizen });
      }

      return c.json({
        citizens: result.data.citizens,
        total: result.data.citizens.length,
      });
    });

    // GET /:matchId/properties — filter by ?citizen_id=X
    sandbox.get("/:matchId/properties", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The dossier vault is sealed.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/properties`, 200, startTime);

      const citizenId = c.req.query("citizen_id");
      if (citizenId) {
        const props = result.data.properties.filter((p) => p.citizen_id === citizenId);
        return c.json({ properties: props, total: props.length });
      }

      return c.json({
        properties: result.data.properties,
        total: result.data.properties.length,
      });
    });

    // GET /:matchId/vehicles — filter by ?citizen_id=X
    sandbox.get("/:matchId/vehicles", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The dossier vault is sealed.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/vehicles`, 200, startTime);

      const citizenId = c.req.query("citizen_id");
      if (citizenId) {
        const vehs = result.data.vehicles.filter((v) => v.citizen_id === citizenId);
        return c.json({ vehicles: vehs, total: vehs.length });
      }

      return c.json({
        vehicles: result.data.vehicles,
        total: result.data.vehicles.length,
      });
    });

    return sandbox;
  },
};
