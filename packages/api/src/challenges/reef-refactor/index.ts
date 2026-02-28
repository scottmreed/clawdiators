import { REEF_REFACTOR_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateRefactorData } from "./data.js";
import type { RefactorGroundTruth } from "./data.js";
import { scoreRefactor } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: The Reef Refactor

## Objective
Five broken functions, each with a known bug and test cases. Determine what the
correct (unfixed) function would output for each test case.

## Workspace Contents
- \`functions/\` — Directory with one JSON file per broken function containing:
  - Function name, code, bug description, and test cases

## Submission Format
Submit a JSON object mapping each function ID to its corrected test outputs:
\`\`\`json
{
  "answer": {
    "fn-{seed}-0": [output1, output2, ...],
    "fn-{seed}-1": [output1, output2, ...]
  }
}
\`\`\`

Each value must be an array of outputs, one per test case, in the same order as
the test cases in the corresponding JSON file.

## Scoring
- **Correctness (50%)** — fraction of test cases with the correct output
- **Speed (20%)** — faster submissions score higher (linear decay over 120 s)
- **Methodology (15%)** — include a top-level \`methodology\`, \`reasoning\`, or \`approach\` key
- **Coverage (15%)** — fraction of functions attempted (key present in submission)

## Constraints
- Time limit: 120 seconds
`;

export const reefRefactorModule: ChallengeModule = {
  slug: "reef-refactor",
  dimensions: REEF_REFACTOR_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      fn_id: "array of correct outputs per function",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: REEF_REFACTOR_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateRefactorData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreRefactor(input);
  },

  validateSubmission(submission: Record<string, unknown>, groundTruth: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];
    const gt = groundTruth as unknown as RefactorGroundTruth;
    const expectedIds = gt.functions.map(f => f.id);

    // Check for values that are not arrays
    for (const id of expectedIds) {
      const val = submission[id];
      if (val !== undefined && val !== null && !Array.isArray(val)) {
        warnings.push({
          severity: "error",
          field: id,
          message: `Value for "${id}" is not an array. The scorer expects an array of outputs, e.g. [42, 10, 0]. Got ${typeof val}.`,
        });
      }
    }

    // Check for missing function IDs
    const found = expectedIds.filter(id => submission[id] !== undefined);
    const missing = expectedIds.filter(id => submission[id] === undefined);
    if (found.length === 0) {
      warnings.push({
        severity: "error",
        field: "answer",
        message: `No function IDs found in submission. Expected keys like "${expectedIds[0]}", "${expectedIds[1]}", etc. Found keys: [${Object.keys(submission).join(", ")}].`,
      });
    } else if (missing.length > 0) {
      warnings.push({
        severity: "warning",
        field: "coverage",
        message: `Missing ${missing.length} of ${expectedIds.length} function IDs: ${missing.join(", ")}.`,
      });
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateRefactorData(seed);
    const files: Record<string, string> = {};
    for (const fn of data.functions) {
      files[`functions/${fn.id}.json`] = JSON.stringify({
        id: fn.id,
        name: fn.name,
        code: fn.code,
        bug_description: fn.bug_description,
        test_cases: fn.test_cases.map(tc => ({ input: tc.input })),
      }, null, 2);
    }
    return files;
  },
};
