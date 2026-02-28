import { PERFORMANCE_OPTIMIZER_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateOptimizerData } from "./data.js";
import { scoreOptimizer } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: Performance Optimizer

## Objective
A function in this workspace works correctly but is painfully slow.
Your job: rewrite it to be as fast as possible without changing its behavior.

## Your Task
1. Read the source code to understand the current (slow) implementation
2. Identify the performance bottleneck (e.g. nested loops, linear scans)
3. Rewrite the function with a more efficient algorithm (e.g. using Set/Map for O(1) lookups)
4. Read the test suite to verify your optimization preserves correctness

## Workspace Contents
- \`src/\` — Source code with the slow function
- \`tests/\` — Test suite verifying correctness (read to understand expected behavior)
- \`benchmark.ts\` — Benchmark script (for reference only)
- \`package.json\`, \`tsconfig.json\` — Project config

## How Scoring Works
Scoring is done via **static analysis** of your submitted code and explanation.
The scorer does not execute your code or run benchmarks. Specifically:

- **Optimization** checks for structural improvements: use of efficient data structures
  (Set, Map), removal of nested loops, and removal of linear-scan patterns like \`.includes()\`.
- **Correctness** checks structural indicators: presence of the original function name,
  return statements, type annotations, and evidence of data structure usage.
- **Methodology** checks your explanation for relevant keywords (complexity analysis,
  bottleneck identification, data structure choices).

## Submission Format
Submit a JSON object with:
\`\`\`json
{
  "answer": {
    "optimized_code": "the full rewritten function (including export keyword)",
    "explanation": "what you changed and why — describe the algorithmic improvement, complexity, and bottleneck"
  }
}
\`\`\`

## Scoring
- **Optimization (40%)** — Use of efficient data structures, removal of nested loops
- **Correctness (25%)** — Structural correctness (function name, return, types)
- **Speed (15%)** — Time to submission
- **Methodology (20%)** — Quality of explanation (complexity analysis, bottleneck identification)

## Constraints
- Time limit: 1800 seconds
- Function signature and exports must be preserved
- Do not modify test files
`;

export const performanceOptimizerModule: ChallengeModule = {
  slug: "performance-optimizer",
  dimensions: PERFORMANCE_OPTIMIZER_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      optimized_code: "string",
      explanation: "string",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: PERFORMANCE_OPTIMIZER_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateOptimizerData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreOptimizer(input);
  },

  validateSubmission(submission: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];

    if (!submission.optimized_code && !submission.code) {
      warnings.push({
        severity: "error",
        field: "optimized_code",
        message: `Missing "optimized_code" key. Submit the full rewritten function including the export keyword.`,
      });
    } else if (typeof (submission.optimized_code ?? submission.code) !== "string") {
      warnings.push({
        severity: "error",
        field: "optimized_code",
        message: `Expected a string value for "optimized_code", got ${typeof (submission.optimized_code ?? submission.code)}. Submit the function source code as a string.`,
      });
    }

    if (!submission.explanation && !submission.approach) {
      warnings.push({
        severity: "error",
        field: "explanation",
        message: `Missing "explanation" key. Describe what you changed and why — include complexity analysis and bottleneck identification.`,
      });
    } else if (typeof (submission.explanation ?? submission.approach) !== "string") {
      warnings.push({
        severity: "error",
        field: "explanation",
        message: `Expected a string value for "explanation", got ${typeof (submission.explanation ?? submission.approach)}. Submit your explanation as a string.`,
      });
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateOptimizerData(seed);
    return data.files;
  },
};
