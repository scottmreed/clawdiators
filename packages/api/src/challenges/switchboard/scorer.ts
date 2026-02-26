import { MAX_SCORE } from "@clawdiators/shared";
import type { ScoringInput, ScoreResult } from "../types.js";
import type { SwitchboardGroundTruth } from "./data.js";

const WEIGHTS = { accuracy: 0.4, source_selection: 0.3, speed: 0.15, efficiency: 0.15 };
const TIME_LIMIT = 120;
const POINTS_PER_QUESTION = 200; // 5 questions * 200 = 1000 max

export function scoreSwitchboard(input: ScoringInput): ScoreResult {
  const { submission, groundTruth: gt, startedAt, submittedAt, apiCallCount } = input;
  const groundTruth = gt as unknown as SwitchboardGroundTruth;

  // === Accuracy (0-1000 raw) ===
  // Each correct district match = 200 pts, 5 questions = max 1000
  let accuracyRaw = 0;

  for (const truth of groundTruth.answers) {
    const submitted = submission[truth.question_id];
    if (submitted === undefined || submitted === null) continue;

    const submittedDistrict = String(submitted).trim().toLowerCase();
    const truthDistrict = truth.answer.trim().toLowerCase();

    if (submittedDistrict === truthDistrict) {
      accuracyRaw += POINTS_PER_QUESTION;
    }
  }
  accuracyRaw = Math.min(1000, accuracyRaw);

  // === Source Selection (0-1000 raw) ===
  // If the submission includes sources_used as { [question_id]: string[] },
  // check if the agent accessed the authoritative sources for each question.
  // If sources_used is not provided, derive partial credit from accuracy
  // (correct answer implies correct sources were consulted).
  let sourceRaw = 0;
  const sourcesUsed = submission.sources_used as
    | Record<string, string[]>
    | undefined;

  if (sourcesUsed && typeof sourcesUsed === "object") {
    for (const truth of groundTruth.answers) {
      const agentSources = sourcesUsed[truth.question_id];
      if (!agentSources || !Array.isArray(agentSources)) continue;

      const needed = new Set(truth.sources_needed);
      const provided = new Set(agentSources.map((s) => s.toLowerCase()));

      // Check all authoritative sources were consulted
      let allNeeded = true;
      for (const n of needed) {
        if (!provided.has(n)) {
          allNeeded = false;
          break;
        }
      }

      if (allNeeded) {
        // Full credit if agent used exactly the authoritative sources (no unnecessary ones)
        const extraSources = agentSources.filter(
          (s) => !needed.has(s.toLowerCase()),
        ).length;
        if (extraSources === 0) {
          sourceRaw += POINTS_PER_QUESTION;
        } else {
          // Partial credit: used correct sources but also queried extras
          sourceRaw += Math.round(POINTS_PER_QUESTION * 0.7);
        }
      } else {
        // Partial: some authoritative sources consulted
        let matchCount = 0;
        for (const n of needed) {
          if (provided.has(n)) matchCount++;
        }
        sourceRaw += Math.round(
          POINTS_PER_QUESTION * 0.4 * (matchCount / needed.size),
        );
      }
    }
  } else {
    // No sources_used provided — derive from accuracy (correct answer = likely correct sources)
    // Give 60% of max source score based on accuracy
    sourceRaw = Math.round(accuracyRaw * 0.6);
  }
  sourceRaw = Math.min(1000, sourceRaw);

  // === Speed (0-1000 raw) ===
  const elapsedSecs =
    (submittedAt.getTime() - startedAt.getTime()) / 1000;
  const speedRaw =
    elapsedSecs >= TIME_LIMIT
      ? 0
      : Math.round(1000 * (1 - elapsedSecs / TIME_LIMIT));

  // === Efficiency (0-1000 raw) ===
  // Optimal: ~5 calls (one per question to relevant source combos)
  // Could also be 4 calls (one per data source to get all districts)
  let efficiencyRaw: number;
  if (apiCallCount <= 5) efficiencyRaw = 1000;
  else if (apiCallCount <= 8) efficiencyRaw = 800;
  else if (apiCallCount <= 15) efficiencyRaw = 600;
  else if (apiCallCount <= 25) efficiencyRaw = 200;
  else efficiencyRaw = 100;

  // === Weighted total ===
  const accuracy = Math.round(accuracyRaw * WEIGHTS.accuracy);
  const source_selection = Math.round(sourceRaw * WEIGHTS.source_selection);
  const speed = Math.round(speedRaw * WEIGHTS.speed);
  const efficiency = Math.round(efficiencyRaw * WEIGHTS.efficiency);
  const total = Math.min(
    MAX_SCORE,
    accuracy + source_selection + speed + efficiency,
  );

  return {
    breakdown: { accuracy, source_selection, speed, efficiency, total },
  };
}
