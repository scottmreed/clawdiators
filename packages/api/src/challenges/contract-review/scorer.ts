import { MAX_SCORE } from "@clawdiators/shared";
import type { ScoringInput, ScoreResult } from "../types.js";
import type { ContractGroundTruth } from "./data.js";

const WEIGHTS = { precision: 0.35, recall: 0.35, speed: 0.15, efficiency: 0.15 };
const TIME_LIMIT = 300;

interface SubmittedIssue {
  type?: string;
  section_ids?: string[];
  description?: string;
}

/**
 * Check whether a submitted issue matches a ground truth issue.
 * Match requires: same type AND at least one overlapping section_id.
 */
function issueMatches(submitted: SubmittedIssue, truth: { type: string; section_ids: string[] }): boolean {
  if (submitted.type !== truth.type) return false;
  if (!Array.isArray(submitted.section_ids) || submitted.section_ids.length === 0) return false;
  return submitted.section_ids.some(sid => truth.section_ids.includes(sid));
}

export function scoreContract(input: ScoringInput): ScoreResult {
  const { submission, groundTruth: gt, startedAt, submittedAt, apiCallCount } = input;
  const groundTruth = gt as unknown as ContractGroundTruth;

  const submittedIssues: SubmittedIssue[] = Array.isArray(submission.issues) ? submission.issues as SubmittedIssue[] : [];
  const truthIssues = groundTruth.issues;

  // === Precision (0-1000 raw) ===
  // Of the reported issues, how many match a ground truth issue?
  let truePositives = 0;
  const matchedTruthIndices = new Set<number>();

  for (const submitted of submittedIssues) {
    let matched = false;
    for (let i = 0; i < truthIssues.length; i++) {
      if (matchedTruthIndices.has(i)) continue;
      if (issueMatches(submitted, truthIssues[i])) {
        truePositives++;
        matchedTruthIndices.add(i);
        matched = true;
        break;
      }
    }
    // If not matched, it's a false positive (lowers precision)
  }

  const precisionRaw = submittedIssues.length > 0
    ? Math.round((truePositives / submittedIssues.length) * 1000)
    : 0;

  // === Recall (0-1000 raw) ===
  // Of the ground truth issues, how many were found?
  // Points per issue: 1000 / total_issues
  const recallRaw = truthIssues.length > 0
    ? Math.round((truePositives / truthIssues.length) * 1000)
    : 0;

  // === Speed (0-1000 raw) ===
  const elapsedSecs = (submittedAt.getTime() - startedAt.getTime()) / 1000;
  const speedRaw = elapsedSecs >= TIME_LIMIT ? 0 : Math.round(1000 * (1 - elapsedSecs / TIME_LIMIT));

  // === Efficiency (0-1000 raw) ===
  // Optimal: 5-10 calls (read contract list, definitions, + key sections)
  let efficiencyRaw: number;
  if (apiCallCount <= 10) efficiencyRaw = 1000;
  else if (apiCallCount <= 15) efficiencyRaw = 800;
  else if (apiCallCount <= 30) efficiencyRaw = 600;
  else if (apiCallCount <= 60) efficiencyRaw = 400;
  else efficiencyRaw = 200;

  // Weighted total
  const precision = Math.round(precisionRaw * WEIGHTS.precision);
  const recall = Math.round(recallRaw * WEIGHTS.recall);
  const speed = Math.round(speedRaw * WEIGHTS.speed);
  const efficiency = Math.round(efficiencyRaw * WEIGHTS.efficiency);
  const total = Math.min(MAX_SCORE, precision + recall + speed + efficiency);

  return { breakdown: { precision, recall, speed, efficiency, total } };
}
