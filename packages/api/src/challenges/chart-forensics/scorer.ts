import { MAX_SCORE } from "@clawdiators/shared";
import type { ScoringInput, ScoreResult } from "../types.js";
import type { ForensicsGroundTruth } from "./data.js";

const WEIGHTS = { precision: 0.35, recall: 0.35, speed: 0.15, efficiency: 0.15 };
const TIME_LIMIT = 180;

export function scoreForensics(input: ScoringInput): ScoreResult {
  const { submission, groundTruth: gt, startedAt, submittedAt, apiCallCount } = input;
  const groundTruth = gt as unknown as ForensicsGroundTruth;

  // === Precision (0-1000 raw) ===
  // Of issues reported by the agent, how many match ground truth?
  const submittedIssues = Array.isArray(submission.issues)
    ? (submission.issues as Array<{ chart_id?: string; issue_type?: string; description?: string }>)
    : [];

  let truePositives = 0;
  const matchedGtIndices = new Set<number>();

  for (const reported of submittedIssues) {
    if (!reported.chart_id) continue;

    // Find a matching ground truth issue by chart_id + issue_type
    for (let i = 0; i < groundTruth.issues.length; i++) {
      if (matchedGtIndices.has(i)) continue;
      const gtIssue = groundTruth.issues[i];

      if (reported.chart_id === gtIssue.chart_id && reported.issue_type === gtIssue.issue_type) {
        truePositives++;
        matchedGtIndices.add(i);
        break;
      }
    }
  }

  // Precision: true positives / total reported
  const precisionRaw = submittedIssues.length > 0
    ? Math.round((truePositives / submittedIssues.length) * 1000)
    : 0;

  // === Recall (0-1000 raw) ===
  // Of ground truth issues, how many did the agent find? Match by chart_id.
  let recallHits = 0;
  for (const gtIssue of groundTruth.issues) {
    const found = submittedIssues.some(
      (r) => r.chart_id === gtIssue.chart_id,
    );
    if (found) recallHits++;
  }

  const recallRaw = groundTruth.issues.length > 0
    ? Math.round((recallHits / groundTruth.issues.length) * 1000)
    : 0;

  // === Speed (0-1000 raw) ===
  const elapsedSecs = (submittedAt.getTime() - startedAt.getTime()) / 1000;
  const speedRaw = elapsedSecs >= TIME_LIMIT ? 0 : Math.round(1000 * (1 - elapsedSecs / TIME_LIMIT));

  // === Efficiency (0-1000 raw) ===
  // Optimal: 2-3 calls (get data + charts), 5 = 800, 10 = 600, 20+ = 200
  let efficiencyRaw: number;
  if (apiCallCount <= 3) efficiencyRaw = 1000;
  else if (apiCallCount <= 5) efficiencyRaw = 800;
  else if (apiCallCount <= 10) efficiencyRaw = 600;
  else if (apiCallCount <= 20) efficiencyRaw = 400;
  else efficiencyRaw = 200;

  // Weighted total
  const precision = Math.round(precisionRaw * WEIGHTS.precision);
  const recall = Math.round(recallRaw * WEIGHTS.recall);
  const speed = Math.round(speedRaw * WEIGHTS.speed);
  const efficiency = Math.round(efficiencyRaw * WEIGHTS.efficiency);
  const total = Math.min(MAX_SCORE, precision + recall + speed + efficiency);

  return { breakdown: { precision, recall, speed, efficiency, total } };
}
