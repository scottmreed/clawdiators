import { MAX_SCORE } from "@clawdiators/shared";
import type { ScoringInput, ScoreResult } from "../types.js";
import type { SupplyChainGroundTruth } from "./data.js";

const WEIGHTS = { profit: 0.35, fulfillment: 0.3, speed: 0.15, efficiency: 0.2 };
const TIME_LIMIT = 3600; // 1 hour

export function scoreSupplyChain(input: ScoringInput): ScoreResult {
  const { submission, groundTruth: gt, startedAt, submittedAt, apiCallCount } = input;
  const groundTruth = gt as unknown as SupplyChainGroundTruth;

  // === Profit (0-1000 raw): submitted profit / optimal profit ===
  let profitRaw = 0;
  const submittedProfit = Number(submission.total_profit ?? submission.profit ?? 0);
  if (submittedProfit > 0 && groundTruth.optimal_profit > 0) {
    const ratio = Math.min(1, submittedProfit / groundTruth.optimal_profit);
    profitRaw = Math.round(ratio * 1000);
  }

  // === Fulfillment (0-1000 raw): submitted ratio / optimal ratio ===
  let fulfillmentRaw = 0;
  const submittedFulfillment = Number(submission.fulfillment_ratio ?? submission.fulfillment ?? 0);
  if (submittedFulfillment > 0 && groundTruth.optimal_fulfillment > 0) {
    const ratio = Math.min(1, submittedFulfillment / groundTruth.optimal_fulfillment);
    fulfillmentRaw = Math.round(ratio * 1000);
  }

  // === Speed (0-1000 raw): 1 - elapsed/limit ===
  const elapsedSecs = (submittedAt.getTime() - startedAt.getTime()) / 1000;
  const speedRaw = Math.round(Math.max(0, 1 - elapsedSecs / TIME_LIMIT) * 1000);

  // === Efficiency (0-1000 raw): API calls per period ===
  const totalPeriods = groundTruth.periods.length; // 30
  const callsPerPeriod = apiCallCount / Math.max(totalPeriods, 1);
  let efficiencyRaw: number;
  if (callsPerPeriod <= 2) efficiencyRaw = 1000;
  else if (callsPerPeriod <= 3) efficiencyRaw = 800;
  else if (callsPerPeriod <= 5) efficiencyRaw = 600;
  else if (callsPerPeriod <= 10) efficiencyRaw = 400;
  else efficiencyRaw = 200;

  // Weighted total
  const profit = Math.round(profitRaw * WEIGHTS.profit);
  const fulfillment = Math.round(fulfillmentRaw * WEIGHTS.fulfillment);
  const speed = Math.round(speedRaw * WEIGHTS.speed);
  const efficiency = Math.round(efficiencyRaw * WEIGHTS.efficiency);
  const total = Math.min(MAX_SCORE, profit + fulfillment + speed + efficiency);

  return { breakdown: { profit, fulfillment, speed, efficiency, total } };
}
