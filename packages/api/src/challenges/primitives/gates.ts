/**
 * Machine gates for community challenge validation.
 * All gates run before a draft enters human/agent review.
 */
import type { GateResult, GateReport } from "@clawdiators/shared";
import { validateSpec, verifyDeterminism } from "./validator.js";
import { createDeclarativeModule } from "./declarative-module.js";
import type { CommunitySpec } from "./validator.js";
import type { ChallengeModule } from "../types.js";

export const GATE_PASS_SCORE_THRESHOLD = 0.6;
export const GATE_PROBE_SCORE_CEILING = 0.3;

// ── Gate 1: Spec Validity ────────────────────────────────────────────

/**
 * Validate the raw spec against the community spec Zod schema.
 */
export function checkSpecValidity(raw: unknown): GateResult {
  const result = validateSpec(raw);
  if (result.valid) {
    return { passed: true, details: {} };
  }
  return {
    passed: false,
    details: { errors: result.errors },
    error: `Spec validation failed: ${result.errors.join("; ")}`,
  };
}

// ── Gate 2: Determinism ──────────────────────────────────────────────

/**
 * Verify that generateData produces identical output for the same seed.
 */
export function checkDeterminism(mod: ChallengeModule): GateResult {
  const result = verifyDeterminism((seed) => mod.generateData(seed, {}));
  if (result.deterministic) {
    return { passed: true, details: { seeds_tested: [42, 123, 7777] } };
  }
  return {
    passed: false,
    details: { seeds_tested: [42, 123, 7777] },
    error: result.error,
  };
}

// ── Gate 3: Contract Consistency ─────────────────────────────────────

/**
 * Purely structural checks — no execution required.
 * Verifies scorer fields, seed placeholder, and time dimension references.
 */
export function checkContractConsistency(spec: CommunitySpec): GateResult {
  const issues: string[] = [];

  // If json submission has schema and scorer has fields, check all scorer keys exist in schema
  if (
    spec.submission.type === "json" &&
    spec.submission.schema &&
    spec.scorer?.fields
  ) {
    const schemaKeys = new Set(Object.keys(spec.submission.schema));
    for (const field of spec.scorer.fields) {
      if (!schemaKeys.has(field.key)) {
        issues.push(
          `Scorer field "${field.key}" not found in submission.schema`,
        );
      }
    }
  }

  // If workspace is seedable, challengeMd must contain {{seed}}
  if (spec.workspace.seedable && !spec.workspace.challengeMd.includes("{{seed}}")) {
    issues.push(
      'workspace.seedable is true but challengeMd does not contain {{seed}}',
    );
  }

  // If scorer references a timeDimension, it must exist in scoring.dimensions
  if (spec.scorer?.timeDimension) {
    const dimKeys = new Set(spec.scoring.dimensions.map((d) => d.key));
    if (!dimKeys.has(spec.scorer.timeDimension)) {
      issues.push(
        `scorer.timeDimension "${spec.scorer.timeDimension}" not found in scoring.dimensions`,
      );
    }
  }

  if (issues.length === 0) {
    return { passed: true, details: {} };
  }
  return {
    passed: false,
    details: { issues },
    error: `Contract consistency issues: ${issues.join("; ")}`,
  };
}

// ── Gate 4: Baseline Solveability ────────────────────────────────────

/**
 * Score a reference answer — must reach 60% of maxScore.
 */
export function checkBaselineSolveability(
  spec: CommunitySpec,
  mod: ChallengeModule,
  referenceAnswer: { seed: number; answer: Record<string, unknown> },
): GateResult {
  const threshold = GATE_PASS_SCORE_THRESHOLD * spec.scoring.maxScore;

  let data: ReturnType<typeof mod.generateData>;
  try {
    data = mod.generateData(referenceAnswer.seed, {});
  } catch (err) {
    return {
      passed: false,
      details: {},
      error: `generateData threw: ${String(err)}`,
    };
  }

  const now = new Date();
  const startedAt = new Date(now.getTime() - 1000); // 1s ago

  let result: ReturnType<typeof mod.score>;
  try {
    result = mod.score({
      submission: referenceAnswer.answer,
      groundTruth: data.groundTruth,
      startedAt,
      submittedAt: now,
      apiCallCount: 0,
    });
  } catch (err) {
    return {
      passed: false,
      details: {},
      error: `score() threw: ${String(err)}`,
    };
  }

  const total = result.breakdown.total ?? 0;
  const passed = total >= threshold;

  return {
    passed,
    details: {
      score: total,
      threshold,
      maxScore: spec.scoring.maxScore,
    },
    ...(!passed && {
      error: `Reference answer scored ${total} < threshold ${threshold} (${Math.round(GATE_PASS_SCORE_THRESHOLD * 100)}% of ${spec.scoring.maxScore})`,
    }),
  };
}

// ── Gate 5: Anti-Gaming ──────────────────────────────────────────────

/**
 * Run adversarial probes — all must score below 30% of maxScore.
 * Probes: empty submission, all-null fields, random UUID values.
 */
export function checkAntiGaming(
  spec: CommunitySpec,
  mod: ChallengeModule,
  referenceAnswer: { seed: number; answer: Record<string, unknown> },
): GateResult {
  const ceiling = GATE_PROBE_SCORE_CEILING * spec.scoring.maxScore;
  const probeKeys = Object.keys(referenceAnswer.answer);

  let data: ReturnType<typeof mod.generateData>;
  try {
    data = mod.generateData(referenceAnswer.seed, {});
  } catch (err) {
    return {
      passed: false,
      details: {},
      error: `generateData threw: ${String(err)}`,
    };
  }

  const now = new Date();
  const startedAt = new Date(now.getTime() - 1000);

  const probes: Array<{ name: string; submission: Record<string, unknown> }> = [
    { name: "empty", submission: {} },
    {
      name: "all_null",
      submission: Object.fromEntries(probeKeys.map((k) => [k, null])),
    },
    {
      name: "random_uuid",
      submission: Object.fromEntries(
        probeKeys.map((k) => [
          k,
          "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = Math.floor(Math.random() * 16);
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          }),
        ]),
      ),
    },
  ];

  let worstScore = 0;
  const probeResults: Array<{ name: string; score: number }> = [];

  for (const probe of probes) {
    let result: ReturnType<typeof mod.score>;
    try {
      result = mod.score({
        submission: probe.submission,
        groundTruth: data.groundTruth,
        startedAt,
        submittedAt: now,
        apiCallCount: 0,
      });
    } catch {
      // Probe that throws is treated as score 0 — that's fine
      probeResults.push({ name: probe.name, score: 0 });
      continue;
    }
    const score = result.breakdown.total ?? 0;
    probeResults.push({ name: probe.name, score });
    if (score > worstScore) worstScore = score;
  }

  const passed = worstScore < ceiling;

  return {
    passed,
    details: {
      probe_results: probeResults,
      worst_probe_score: worstScore,
      ceiling,
      maxScore: spec.scoring.maxScore,
    },
    ...(!passed && {
      error: `Anti-gaming probe scored ${worstScore} >= ceiling ${ceiling} (${Math.round(GATE_PROBE_SCORE_CEILING * 100)}% of ${spec.scoring.maxScore})`,
    }),
  };
}

// ── Gate 6: Score Distribution ───────────────────────────────────────

/**
 * Cross-reference gates 4 + 5:
 * - reference score >= 60%
 * - max probe score < 30%
 * - reference score > max probe score
 * Derived from earlier results — no new execution.
 */
export function checkScoreDistribution(
  referenceScore: number,
  probeScores: number[],
  maxScore: number,
): GateResult {
  const passCeiling = GATE_PASS_SCORE_THRESHOLD * maxScore;
  const probeCeiling = GATE_PROBE_SCORE_CEILING * maxScore;
  const maxProbeScore = probeScores.length > 0 ? Math.max(...probeScores) : 0;
  const issues: string[] = [];

  if (referenceScore < passCeiling) {
    issues.push(`Reference score ${referenceScore} < ${passCeiling} (60% of ${maxScore})`);
  }
  if (maxProbeScore >= probeCeiling) {
    issues.push(`Max probe score ${maxProbeScore} >= ${probeCeiling} (30% of ${maxScore})`);
  }
  if (referenceScore <= maxProbeScore) {
    issues.push(`Score inversion: reference ${referenceScore} <= max probe ${maxProbeScore}`);
  }

  if (issues.length === 0) {
    return {
      passed: true,
      details: { reference_score: referenceScore, max_probe_score: maxProbeScore, max_score: maxScore },
    };
  }
  return {
    passed: false,
    details: { reference_score: referenceScore, max_probe_score: maxProbeScore, max_score: maxScore, issues },
    error: issues.join("; "),
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────

/**
 * Run all 6 gates sequentially.
 * Fails fast on gate 1 (spec validity) — subsequent gates need a valid parsed spec.
 */
export async function runAllGates(
  raw: unknown,
  referenceAnswer: { seed: number; answer: Record<string, unknown> },
  currentDesignGuideHash: string,
): Promise<GateReport> {
  const generated_at = new Date().toISOString();

  // Gate 1 — spec validity (fail fast)
  const specValidityResult = checkSpecValidity(raw);
  if (!specValidityResult.passed) {
    return {
      gates: {
        spec_validity: specValidityResult,
        determinism: { passed: false, details: {}, error: "Skipped — spec invalid" },
        contract_consistency: { passed: false, details: {}, error: "Skipped — spec invalid" },
        baseline_solveability: { passed: false, details: {}, error: "Skipped — spec invalid" },
        anti_gaming: { passed: false, details: {}, error: "Skipped — spec invalid" },
        score_distribution: { passed: false, details: {}, error: "Skipped — spec invalid" },
        design_guide_hash: { passed: false, details: {}, error: "Skipped — spec invalid" },
      },
      overall: "fail",
      generated_at,
    };
  }

  const validationResult = validateSpec(raw);
  if (!validationResult.valid) {
    // Shouldn't happen since gate 1 passed, but satisfy TypeScript
    throw new Error("Unexpected: spec invalid after gate 1 passed");
  }
  const spec = validationResult.spec;

  // Build declarative module for execution gates
  const mod = createDeclarativeModule(spec);

  // Gate 2 — determinism
  const determinismResult = checkDeterminism(mod);

  // Gate 3 — contract consistency
  const contractResult = checkContractConsistency(spec);

  // Gate 4 — baseline solveability
  const baselineResult = checkBaselineSolveability(spec, mod, referenceAnswer);

  // Gate 5 — anti-gaming
  const antiGamingResult = checkAntiGaming(spec, mod, referenceAnswer);

  // Gate 6 — score distribution (derived from gates 4+5)
  const probeResults = (antiGamingResult.details as {
    probe_results?: Array<{ name: string; score: number }>;
  }).probe_results ?? [];
  const probeScores = probeResults.map((p: { name: string; score: number }) => p.score);
  const referenceScore = (baselineResult.details as { score?: number }).score ?? 0;
  const scoreDistResult = checkScoreDistribution(referenceScore, probeScores, spec.scoring.maxScore);

  // Gate 7 — design guide hash (optional metadata gate)
  let designGuideHashResult: GateResult;
  const submittedHash = (raw as Record<string, unknown>)?.protocolMetadata as
    | { designGuideHash?: string }
    | undefined;
  if (submittedHash?.designGuideHash) {
    const matches = submittedHash.designGuideHash === currentDesignGuideHash;
    designGuideHashResult = {
      passed: matches,
      details: {
        submitted: submittedHash.designGuideHash,
        current: currentDesignGuideHash,
      },
      ...(!matches && {
        error: `Design guide hash mismatch — spec authored against outdated guide`,
      }),
    };
  } else {
    // No hash submitted — warn but don't fail
    designGuideHashResult = {
      passed: true,
      details: { note: "No designGuideHash provided in protocolMetadata — skipped" },
    };
  }

  const allGates = [
    specValidityResult,
    determinismResult,
    contractResult,
    baselineResult,
    antiGamingResult,
    scoreDistResult,
  ];

  const anyFailed = allGates.some((g) => !g.passed);
  const designGuideFailed = !designGuideHashResult.passed;

  let overall: "pass" | "fail" | "warn";
  if (anyFailed) {
    overall = "fail";
  } else if (designGuideFailed) {
    overall = "warn";
  } else {
    overall = "pass";
  }

  return {
    gates: {
      spec_validity: specValidityResult,
      determinism: determinismResult,
      contract_consistency: contractResult,
      baseline_solveability: baselineResult,
      anti_gaming: antiGamingResult,
      score_distribution: scoreDistResult,
      design_guide_hash: designGuideHashResult,
    },
    overall,
    generated_at,
  };
}
