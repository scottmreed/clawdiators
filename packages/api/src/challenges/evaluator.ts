import type { ScoreBreakdown } from "@clawdiators/shared";
import type { ChallengeModule, ScoringInput, ScoreResult } from "./types.js";

/**
 * Evaluation audit trail — records how a submission was scored.
 */
export interface EvaluationLog {
  method: string;
  startedAt: string;
  completedAt: string;
  scores: Record<string, number>;
  total: number;
  errors: string[];
}

/**
 * Evaluate a submission for a workspace-based challenge.
 *
 * Dispatches to the appropriate evaluation method based on the challenge's scoring spec.
 * For Phase 1, "deterministic" is fully implemented; others are stubbed.
 */
export function evaluate(
  mod: ChallengeModule,
  input: ScoringInput,
): { result: ScoreResult; log: EvaluationLog } {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  const scoringSpec = mod.scoringSpec;
  const method = scoringSpec?.method ?? "deterministic";

  let result: ScoreResult;

  switch (method) {
    case "deterministic":
      // Use the module's existing score function
      result = mod.score(input);
      break;

    case "test-suite":
      // Phase 3: run tests in Docker container
      // For now, fall back to module's score function if available
      errors.push("test-suite evaluation not yet implemented; using module scorer");
      result = mod.score(input);
      break;

    case "custom-script":
      // Phase 3: run evaluator script in sandbox
      errors.push("custom-script evaluation not yet implemented; using module scorer");
      result = mod.score(input);
      break;

    case "llm-judge":
      // Phase 3: call LLM API with rubric
      errors.push("llm-judge evaluation not yet implemented; using module scorer");
      result = mod.score(input);
      break;

    default:
      errors.push(`Unknown scoring method: ${method}; using module scorer`);
      result = mod.score(input);
  }

  const completedAt = new Date().toISOString();

  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(result.breakdown)) {
    if (key === "total") continue;
    scores[key] = value;
  }

  return {
    result,
    log: {
      method,
      startedAt,
      completedAt,
      scores,
      total: result.breakdown.total,
      errors,
    },
  };
}

/**
 * Compute a weighted total from raw dimension scores and dimension definitions.
 * Utility for challenge modules that want to build ScoreBreakdown manually.
 */
export function computeWeightedTotal(
  rawScores: Record<string, number>,
  dimensions: { key: string; weight: number }[],
): ScoreBreakdown {
  let total = 0;
  const breakdown: ScoreBreakdown = {};

  for (const dim of dimensions) {
    const raw = rawScores[dim.key] ?? 0;
    const weighted = Math.round(raw * dim.weight);
    breakdown[dim.key] = weighted;
    total += weighted;
  }

  breakdown.total = total;
  return breakdown;
}
