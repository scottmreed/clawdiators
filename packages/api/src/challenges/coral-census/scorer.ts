import { MAX_SCORE } from "@clawdiators/shared";
import type { ScoringInput, ScoreResult } from "../types.js";
import type { CensusGroundTruth } from "./data.js";

const WEIGHTS = { accuracy: 0.4, state_mgmt: 0.3, speed: 0.15, efficiency: 0.15 };
const TIME_LIMIT = 240;

export function scoreCensus(input: ScoringInput): ScoreResult {
  const { submission, groundTruth: gt, startedAt, submittedAt, apiCallCount, checkpoints } = input;
  const groundTruth = gt as unknown as CensusGroundTruth;

  // === Accuracy: final populations per region (0-1000 raw) ===
  let accuracyRaw = 0;

  // Check final populations (700 points distributed across 6 regions)
  if (submission.populations && typeof submission.populations === "object") {
    const submittedPops = submission.populations as Record<string, number>;
    const truthPops = groundTruth.final_populations;
    const regionKeys = Object.keys(truthPops);
    const pointsPerRegion = Math.round(700 / regionKeys.length); // ~117 each

    for (const region of regionKeys) {
      const submitted = submittedPops[region];
      if (submitted !== undefined) {
        const expected = truthPops[region];
        const diff = Math.abs(Number(submitted) - expected);
        if (diff === 0) accuracyRaw += pointsPerRegion;
        else if (expected !== 0 && diff / Math.abs(expected) <= 0.05) accuracyRaw += Math.round(pointsPerRegion * 0.5);
      }
    }
  }

  // Check total final population (300 points)
  if (submission.total_population !== undefined || submission.total !== undefined) {
    const val = Number(submission.total_population ?? submission.total);
    if (!Number.isNaN(val)) {
      const diff = Math.abs(val - groundTruth.total_final_population);
      if (diff === 0) accuracyRaw += 300;
      else if (diff <= 5) accuracyRaw += 150;
      else if (diff <= 20) accuracyRaw += 50;
    }
  }

  // === Speed ===
  const elapsedSecs = (submittedAt.getTime() - startedAt.getTime()) / 1000;
  const speedRaw = elapsedSecs >= TIME_LIMIT ? 0 : Math.round(1000 * (1 - elapsedSecs / TIME_LIMIT));

  // === Efficiency ===
  // Optimal: 1 (regions) + 5 (batches) = 6 calls, reasonable up to ~10
  let efficiencyRaw: number;
  if (apiCallCount <= 6) efficiencyRaw = 1000;
  else if (apiCallCount <= 10) efficiencyRaw = 900;
  else if (apiCallCount <= 15) efficiencyRaw = 800;
  else if (apiCallCount <= 25) efficiencyRaw = 600;
  else if (apiCallCount <= 50) efficiencyRaw = 400;
  else efficiencyRaw = 200;

  // === State Management: checkpoint accuracy at each batch interval ===
  let stateMgmtRaw = 0;
  const cps = checkpoints ?? [];
  const POINTS_PER_CHECKPOINT = 200; // 5 checkpoints x 200 = 1000

  for (let i = 0; i < 5; i++) {
    if (cps.length >= i + 1) {
      const cp = cps[i] as any;
      const cpData = cp.data || cp;
      if (cpData.populations && typeof cpData.populations === "object") {
        const truth = groundTruth.batch_populations[i];
        let correct = 0;
        const total = Object.keys(truth).length;
        for (const [region, expected] of Object.entries(truth)) {
          if (cpData.populations[region] !== undefined) {
            if (Number(cpData.populations[region]) === expected) correct++;
          }
        }
        stateMgmtRaw += Math.round((correct / Math.max(total, 1)) * POINTS_PER_CHECKPOINT);
      } else {
        stateMgmtRaw += 30; // At least submitted something
      }
    }
  }

  // Weighted total
  const accuracy = Math.round(accuracyRaw * WEIGHTS.accuracy);
  const speed = Math.round(speedRaw * WEIGHTS.speed);
  const efficiency = Math.round(efficiencyRaw * WEIGHTS.efficiency);
  const state_mgmt = Math.round(stateMgmtRaw * WEIGHTS.state_mgmt);
  const total = Math.min(MAX_SCORE, accuracy + speed + efficiency + state_mgmt);

  return { breakdown: { accuracy, speed, efficiency, state_mgmt, total } };
}
