import { THE_MIRAGE_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateMirageData } from "./data.js";
import { scoreMirage } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: The Mirage

## Objective
Three datasets for 15 districts — census, financial, and environmental. Each is
internally consistent, but cross-referencing reveals fabricated data points.

## Workspace Contents
- \`census/\` — Census data files per district
- \`financial/\` — Financial data files per district
- \`environmental/\` — Environmental data files per district

## Submission Format
\`\`\`json
{
  "answer": {
    "fabrications": [
      {
        "district": "district_name",
        "source": "census|financial|environmental",
        "field": "specific field name",
        "explanation": "explanation of why this is fabricated"
      }
    ]
  }
}
\`\`\`

## Scoring Breakdown
| Dimension | Weight | Description |
|---|---|---|
| Detection | 40% | Of the ground-truth fabrications, how many did you find? Matched by district + field or district + source. |
| Precision | 25% | Of your submitted fabrications, how many are real? Avoid false positives. |
| Speed | 15% | Faster submissions score higher (linear decay over the 240s time limit). |
| Thoroughness | 20% | Did you check all three data sources? Full marks for referencing census, financial, and environmental. |

## Constraints
- Time limit: 240 seconds
- Cross-reference all three datasets to find inconsistencies
`;

export const theMirageModule: ChallengeModule = {
  slug: "the-mirage",
  dimensions: THE_MIRAGE_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      fabrications: "[{ district: string, source: string, field: string, explanation: string }]",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: THE_MIRAGE_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateMirageData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreMirage(input);
  },

  validateSubmission(submission: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];

    if (!Array.isArray(submission.fabrications)) {
      warnings.push({
        severity: "error",
        field: "fabrications",
        message: `Expected "fabrications" to be an array, got ${typeof submission.fabrications}. Submit an array of fabrication objects.`,
      });
      return warnings;
    }

    for (let i = 0; i < submission.fabrications.length; i++) {
      const entry = submission.fabrications[i] as Record<string, unknown>;
      if (!entry.district) {
        warnings.push({
          severity: "error",
          field: `fabrications[${i}].district`,
          message: `Fabrication at index ${i} is missing "district". Each entry must include the district name.`,
        });
      }
      if (!entry.field) {
        warnings.push({
          severity: "error",
          field: `fabrications[${i}].field`,
          message: `Fabrication at index ${i} is missing "field". Each entry must include the suspect field name.`,
        });
      }
      if (!entry.source) {
        warnings.push({
          severity: "warning",
          field: `fabrications[${i}].source`,
          message: `Fabrication at index ${i} is missing "source". Each entry should specify the data source (census, financial, or environmental).`,
        });
      }
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateMirageData(seed);
    const files: Record<string, string> = {};
    const census = data.census as unknown as Array<Record<string, unknown>>;
    const financial = data.financial as unknown as Array<Record<string, unknown>>;
    const environmental = data.environmental as unknown as Array<Record<string, unknown>>;
    for (const d of census) {
      files[`census/${d.district}.json`] = JSON.stringify(d, null, 2);
    }
    for (const d of financial) {
      files[`financial/${d.district}.json`] = JSON.stringify(d, null, 2);
    }
    for (const d of environmental) {
      files[`environmental/${d.district}.json`] = JSON.stringify(d, null, 2);
    }
    return files;
  },
};
