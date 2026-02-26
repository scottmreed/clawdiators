import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { SUPPLY_CHAIN_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateSupplyChainData } from "./data.js";
import { scoreSupplyChain } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateSupplyChainData } from "./data.js";
export { scoreSupplyChain } from "./scorer.js";

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!match || match.status !== "active" || new Date() > match.expiresAt) return null;
  const data = generateSupplyChainData(match.seed);
  return { match, data };
}

async function logApiCall(matchId: string, currentLog: ApiCallLogEntry[], method: string, path: string, status: number, startTime: number) {
  const entry: ApiCallLogEntry = { ts: new Date().toISOString(), method, path, status, durationMs: Date.now() - startTime };
  await db.update(matches).set({ apiCallLog: [...currentLog, entry] }).where(eq(matches.id, matchId));
}

export const supplyChainModule: ChallengeModule = {
  slug: "supply-chain",
  dimensions: SUPPLY_CHAIN_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateSupplyChainData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      products: data.products,
      warehouses: data.warehouses,
      total_periods: data.periods.length,
      // Periods are only available via sandbox APIs — not sent upfront
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreSupplyChain(input);
  },

  sandboxApiNames(): string[] {
    return ["inventory", "orders", "disruptions"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/inventory — products and warehouses with current stock
    sandbox.get("/:matchId/inventory", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);
      if (!result) return errorEnvelope(c, "Match not found or expired", 404);
      await logApiCall(matchId, result.match.apiCallLog, "GET", `/sandbox/${matchId}/inventory`, 200, startTime);

      return c.json({
        products: result.data.products.map((p) => ({
          id: p.id,
          name: p.name,
          base_cost: p.base_cost,
          base_price: p.base_price,
          shelf_life: p.shelf_life,
        })),
        warehouses: result.data.warehouses.map((w) => ({
          id: w.id,
          name: w.name,
          capacity: w.capacity,
          operating_cost: w.operating_cost,
        })),
        total_periods: result.data.periods.length,
      });
    });

    // GET /:matchId/orders?period=N — orders for a given period
    sandbox.get("/:matchId/orders", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const periodParam = c.req.query("period");
      if (!periodParam) return errorEnvelope(c, "Missing required query parameter: period", 400);

      const periodNum = parseInt(periodParam, 10);
      if (Number.isNaN(periodNum) || periodNum < 1 || periodNum > 30) {
        return errorEnvelope(c, "Period must be between 1 and 30", 400);
      }

      const result = await getMatchAndData(matchId);
      if (!result) return errorEnvelope(c, "Match not found or expired", 404);
      await logApiCall(matchId, result.match.apiCallLog, "GET", `/sandbox/${matchId}/orders?period=${periodNum}`, 200, startTime);

      const periodData = result.data.periods.find((p) => p.period === periodNum);
      if (!periodData) {
        return c.json({ period: periodNum, orders: [], price_changes: [] });
      }

      return c.json({
        period: periodNum,
        orders: periodData.orders.map((o) => ({
          id: o.id,
          product_id: o.product_id,
          quantity: o.quantity,
          deadline_period: o.deadline_period,
          revenue: o.revenue,
        })),
        price_changes: periodData.price_changes.map((pc) => ({
          product_id: pc.product_id,
          new_price: pc.new_price,
        })),
      });
    });

    // GET /:matchId/disruptions?period=N — active disruptions for a given period
    sandbox.get("/:matchId/disruptions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const periodParam = c.req.query("period");
      if (!periodParam) return errorEnvelope(c, "Missing required query parameter: period", 400);

      const periodNum = parseInt(periodParam, 10);
      if (Number.isNaN(periodNum) || periodNum < 1 || periodNum > 30) {
        return errorEnvelope(c, "Period must be between 1 and 30", 400);
      }

      const result = await getMatchAndData(matchId);
      if (!result) return errorEnvelope(c, "Match not found or expired", 404);
      await logApiCall(matchId, result.match.apiCallLog, "GET", `/sandbox/${matchId}/disruptions?period=${periodNum}`, 200, startTime);

      // Collect all disruptions active during this period (from any period's data)
      const activeDisruptions: Array<{
        id: string;
        warehouse_id: string;
        type: string;
        severity: number;
        start_period: number;
        duration_periods: number;
        periods_remaining: number;
      }> = [];

      for (const pd of result.data.periods) {
        for (const d of pd.disruptions) {
          if (d.start_period <= periodNum && d.start_period + d.duration_periods > periodNum) {
            activeDisruptions.push({
              id: d.id,
              warehouse_id: d.warehouse_id,
              type: d.type,
              severity: d.severity,
              start_period: d.start_period,
              duration_periods: d.duration_periods,
              periods_remaining: d.start_period + d.duration_periods - periodNum,
            });
          }
        }
      }

      return c.json({
        period: periodNum,
        active_disruptions: activeDisruptions,
      });
    });

    return sandbox;
  },
};
