import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { CHART_FORENSICS_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateForensicsData } from "./data.js";
import { scoreForensics } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateForensicsData } from "./data.js";
export { scoreForensics } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateForensicsData(match.seed);
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

export const chartForensicsModule: ChallengeModule = {
  slug: "chart-forensics",
  dimensions: CHART_FORENSICS_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateForensicsData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      tables: data.tables,
      charts: data.charts,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreForensics(input);
  },

  sandboxApiNames(): string[] {
    return ["data", "charts", "descriptions"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/data — returns all tables (or ?tableId=X for specific)
    sandbox.get("/:matchId/data", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The evidence has been washed away.");
      }

      const tableId = c.req.query("tableId");
      if (tableId) {
        const table = result.data.tables.find((t) => t.id === tableId);
        if (!table) {
          await logApiCall(matchId, result.match.apiCallLog, "GET",
            `/sandbox/${matchId}/data?tableId=${tableId}`, 404, startTime);
          return c.json({
            error: "Table not found",
            available_ids: result.data.tables.map((t) => t.id),
          }, 404);
        }
        await logApiCall(matchId, result.match.apiCallLog, "GET",
          `/sandbox/${matchId}/data?tableId=${tableId}`, 200, startTime);
        return c.json({ table });
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/data`, 200, startTime);

      return c.json({
        tables: result.data.tables,
        total: result.data.tables.length,
      });
    });

    // GET /:matchId/data/:tableId — returns single table
    sandbox.get("/:matchId/data/:tableId", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const tableId = c.req.param("tableId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The evidence has been washed away.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/data/${tableId}`, 200, startTime);

      const table = result.data.tables.find((t) => t.id === tableId);
      if (!table) {
        return c.json({
          error: "Table not found",
          available_ids: result.data.tables.map((t) => t.id),
        }, 404);
      }

      return c.json({ table });
    });

    // GET /:matchId/charts — returns all charts with SVGs
    sandbox.get("/:matchId/charts", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The evidence has been washed away.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/charts`, 200, startTime);

      return c.json({
        charts: result.data.charts,
        total: result.data.charts.length,
      });
    });

    // GET /:matchId/charts/:chartId — returns single chart
    sandbox.get("/:matchId/charts/:chartId", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const chartId = c.req.param("chartId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The evidence has been washed away.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/charts/${chartId}`, 200, startTime);

      const chart = result.data.charts.find((ch) => ch.id === chartId);
      if (!chart) {
        return c.json({
          error: "Chart not found",
          available_ids: result.data.charts.map((ch) => ch.id),
        }, 404);
      }

      return c.json({ chart });
    });

    // GET /:matchId/descriptions — returns text descriptions of all charts
    sandbox.get("/:matchId/descriptions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The evidence has been washed away.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/descriptions`, 200, startTime);

      const descriptions = result.data.charts.map((ch) => ({
        chart_id: ch.id,
        table_id: ch.table_id,
        chart_type: ch.chart_type,
        description: ch.description,
      }));

      return c.json({
        descriptions,
        total: descriptions.length,
      });
    });

    return sandbox;
  },
};
