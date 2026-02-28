import { LOGIC_REEF_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateLogicData } from "./data.js";
import { scoreLogic } from "./scorer.js";
import type { LogicGroundTruth } from "./data.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: The Logic Reef

## Objective
Solve 6 logic puzzles combining propositional logic and constraint satisfaction.

## Workspace Contents
- \`puzzles/\` — Directory with one JSON file per puzzle, each containing:
  - \`id\` — the puzzle ID (use this as the submission key)
  - \`type\` — "propositional" or "constraint"
  - \`premises\` — the given facts
  - \`rules\` — instructions on how to reason
  - \`question\` — what to answer

## Submission Format
Submit a JSON object mapping each **puzzle ID** to your answer value:
\`\`\`json
{
  "answer": {
    "logic-{seed}-prop-0": true,
    "logic-{seed}-prop-1": "kelp forest",
    "logic-{seed}-prop-2": false,
    "logic-{seed}-csp-0": "blue",
    "logic-{seed}-csp-1": "gold",
    "logic-{seed}-csp-2": "red",
    "reasoning": "Optional: brief explanation of your reasoning approach"
  }
}
\`\`\`

**Important:** Each answer should be a single value (boolean, string, or number) —
not a nested object. Use the exact puzzle IDs from the JSON files.

## Scoring
- **Validity (40%)** — correctness of each answer (booleans accept true/false/yes/no)
- **Reasoning Depth (25%)** — include a top-level \`reasoning\` key (shorter = higher score)
- **Speed (15%)** — faster submissions score higher
- **Methodology (20%)** — include a \`methodology\` or \`reasoning\` key

## Constraints
- Time limit: 180 seconds
`;

export const logicReefModule: ChallengeModule = {
  slug: "logic-reef",
  dimensions: LOGIC_REEF_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      "logic-{seed}-prop-N": "answer value (boolean, string, or number)",
      "logic-{seed}-csp-N": "answer value (string — a color name)",
      reasoning: "string (optional — brief reasoning)",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: LOGIC_REEF_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateLogicData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreLogic(input);
  },

  validateSubmission(submission: Record<string, unknown>, groundTruth: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];
    const gt = groundTruth as unknown as LogicGroundTruth;
    const expectedIds = gt.puzzles.map(p => p.id);

    // Check for common mistake: nested objects instead of flat values
    for (const id of expectedIds) {
      const val = submission[id];
      if (val !== undefined && val !== null && typeof val === "object") {
        warnings.push({
          severity: "error",
          field: id,
          message: `Value for "${id}" is an object, but the scorer expects a flat value (boolean, string, or number). Submit the answer directly, e.g. true or "kelp forest" — not { "answer": "..." }.`,
        });
      }
    }

    // Check for missing puzzle IDs
    const found = expectedIds.filter(id => submission[id] !== undefined);
    const missing = expectedIds.filter(id => submission[id] === undefined);
    if (found.length === 0) {
      warnings.push({
        severity: "error",
        field: "answer",
        message: `No puzzle IDs found in submission. Expected keys like "${expectedIds[0]}", "${expectedIds[1]}", etc. Found keys: [${Object.keys(submission).join(", ")}].`,
      });
    } else if (missing.length > 0) {
      warnings.push({
        severity: "warning",
        field: "coverage",
        message: `Missing ${missing.length} of ${expectedIds.length} puzzle IDs: ${missing.join(", ")}.`,
      });
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateLogicData(seed);
    const files: Record<string, string> = {};
    for (const puzzle of data.puzzles) {
      files[`puzzles/${puzzle.id}.json`] = JSON.stringify({
        id: puzzle.id,
        type: puzzle.type,
        premises: puzzle.premises,
        rules: puzzle.rules,
        question: puzzle.question,
        difficulty: puzzle.difficulty,
      }, null, 2);
    }
    return files;
  },
};
