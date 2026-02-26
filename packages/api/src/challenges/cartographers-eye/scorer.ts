import { MAX_SCORE } from "@clawdiators/shared";
import type { ScoringInput, ScoreResult } from "../types.js";
import type { CartographerGroundTruth } from "./data.js";

const WEIGHTS = { accuracy: 0.45, spatial_reasoning: 0.25, speed: 0.15, efficiency: 0.15 };
const TIME_LIMIT = 240;

// Adjacent compass directions for half-credit matching
const COMPASS_ORDER = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function isAdjacentDirection(a: string, b: string): boolean {
  const ia = COMPASS_ORDER.indexOf(a.toUpperCase());
  const ib = COMPASS_ORDER.indexOf(b.toUpperCase());
  if (ia === -1 || ib === -1) return false;
  const diff = Math.abs(ia - ib);
  return diff === 1 || diff === 7; // wrap-around (N <-> NW)
}

export function scoreCartographer(input: ScoringInput): ScoreResult {
  const { submission, groundTruth: gt, startedAt, submittedAt, apiCallCount } = input;
  const groundTruth = gt as unknown as CartographerGroundTruth;

  // === Accuracy (0-1000 raw) ===
  // 200 points per question, 5 questions = 1000 max
  const POINTS_PER_QUESTION = 200;
  let accuracyRaw = 0;

  for (const truth of groundTruth.answers) {
    const submitted = submission[truth.question_id];
    if (submitted === undefined || submitted === null) continue;

    const submittedStr = String(submitted).trim();
    const truthStr = String(truth.answer).trim();

    switch (truth.question_id.split("-").pop()) {
      case "1": // closest_region — exact name match
      case "4": // largest_area — exact name match
        if (submittedStr.toLowerCase() === truthStr.toLowerCase()) {
          accuracyRaw += POINTS_PER_QUESTION;
        }
        break;

      case "2": { // distance — within 10% tolerance
        const submittedNum = parseFloat(submittedStr);
        const truthNum = Number(truth.answer);
        if (!isNaN(submittedNum) && truthNum > 0) {
          const tolerance = truthNum * 0.1;
          if (Math.abs(submittedNum - truthNum) <= tolerance) {
            accuracyRaw += POINTS_PER_QUESTION;
          } else if (Math.abs(submittedNum - truthNum) <= tolerance * 2) {
            // Within 20%: half credit
            accuracyRaw += POINTS_PER_QUESTION * 0.5;
          }
        }
        break;
      }

      case "3": { // route_traversal — exact number
        const submittedHops = parseInt(submittedStr, 10);
        const truthHops = Number(truth.answer);
        if (submittedHops === truthHops) {
          accuracyRaw += POINTS_PER_QUESTION;
        }
        break;
      }

      case "5": { // compass_direction — exact or adjacent
        if (submittedStr.toUpperCase() === truthStr.toUpperCase()) {
          accuracyRaw += POINTS_PER_QUESTION;
        } else if (isAdjacentDirection(submittedStr, truthStr)) {
          accuracyRaw += POINTS_PER_QUESTION * 0.5;
        }
        break;
      }
    }
  }

  accuracyRaw = Math.min(1000, Math.round(accuracyRaw));

  // === Spatial Reasoning (0-1000 raw) ===
  // Bonus for showing work: reasoning, coordinates, or calculations
  let reasoningCount = 0;
  const reasoningField = submission.reasoning as Record<string, unknown> | undefined;
  const calculationsField = submission.calculations as Record<string, unknown> | undefined;

  if (reasoningField && typeof reasoningField === "object") {
    reasoningCount += Object.keys(reasoningField).length;
  }
  if (calculationsField && typeof calculationsField === "object") {
    reasoningCount += Object.keys(calculationsField).length;
  }
  // Also check for per-question reasoning keys like "q-xxx-reasoning"
  for (const key of Object.keys(submission)) {
    if (key.includes("reasoning") || key.includes("calculation") || key.includes("explanation")) {
      if (typeof submission[key] === "string" && (submission[key] as string).length > 10) {
        reasoningCount++;
      }
    }
  }
  // Cap at question count
  reasoningCount = Math.min(reasoningCount, 5);

  let spatialReasoningRaw: number;
  if (reasoningCount >= 4) spatialReasoningRaw = 1000;
  else if (reasoningCount === 3) spatialReasoningRaw = 750;
  else if (reasoningCount === 2) spatialReasoningRaw = 500;
  else if (reasoningCount === 1) spatialReasoningRaw = 250;
  else spatialReasoningRaw = 0;

  // === Speed (0-1000 raw) ===
  const elapsedSecs = (submittedAt.getTime() - startedAt.getTime()) / 1000;
  const speedRaw = elapsedSecs >= TIME_LIMIT ? 0 : Math.round(1000 * (1 - elapsedSecs / TIME_LIMIT));

  // === Efficiency (0-1000 raw) ===
  // Optimal: 2-3 calls (map + legend + questions)
  let efficiencyRaw: number;
  if (apiCallCount <= 3) efficiencyRaw = 1000;
  else if (apiCallCount <= 5) efficiencyRaw = 800;
  else if (apiCallCount <= 10) efficiencyRaw = 600;
  else if (apiCallCount <= 20) efficiencyRaw = 400;
  else efficiencyRaw = 200;

  // Weighted total, clamped to MAX_SCORE
  const accuracy = Math.round(accuracyRaw * WEIGHTS.accuracy);
  const spatial_reasoning = Math.round(spatialReasoningRaw * WEIGHTS.spatial_reasoning);
  const speed = Math.round(speedRaw * WEIGHTS.speed);
  const efficiency = Math.round(efficiencyRaw * WEIGHTS.efficiency);
  const total = Math.min(MAX_SCORE, accuracy + spatial_reasoning + speed + efficiency);

  return { breakdown: { accuracy, spatial_reasoning, speed, efficiency, total } };
}
