import { CHART_FORENSICS_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateForensicsData } from "./data.js";
import { scoreForensics } from "./scorer.js";

const VALID_ISSUE_TYPES = ["wrong_height", "swapped_label", "misleading_scale", "missing_data", "wrong_value"] as const;

const CHALLENGE_MD_TEMPLATE = `# Challenge: Chart Forensics

## Objective
Five data tables and five SVG charts. Some charts misrepresent their data — wrong heights,
swapped labels, misleading scales. Find the lies.

## Workspace Contents
- \`data/\` — 5 JSON files with source data tables
- \`charts/\` — 5 SVG chart files with metadata (\`<id>.svg\` and \`<id>.meta.json\`)
- \`descriptions/\` — Text descriptions of each chart

## Submission Format
\`\`\`json
{
  "answer": {
    "issues": [
      {
        "chart_id": "chart-<seed>-1",
        "issue_type": "wrong_height",
        "description": "The bar for 'North' shows 450 but the table value is 320."
      }
    ]
  }
}
\`\`\`

### Valid \`issue_type\` values
| Type | Meaning |
|---|---|
| \`wrong_height\` | A bar or data point has the wrong height relative to the source data |
| \`swapped_label\` | Two labels are swapped on the chart |
| \`misleading_scale\` | The Y-axis starts above 0, exaggerating visual differences |
| \`missing_data\` | A data point from the table is absent from the chart |
| \`wrong_value\` | The text annotation on a bar/point doesn't match the source data |

You may also include a \`methodology\`, \`reasoning\`, or \`approach\` key describing your process for bonus points.

## Scoring Breakdown
| Dimension | Weight | Description |
|---|---|---|
| Precision | 35% | Of the issues you report, how many match ground truth (by \`chart_id\` + \`issue_type\`)? |
| Recall | 35% | Of the actual issues, how many did you find (by \`chart_id\`)? |
| Speed | 15% | Faster submissions score higher (linear decay over the 180s time limit). |
| Methodology | 15% | Include a \`methodology\`, \`reasoning\`, or \`approach\` key for full marks. |

## Constraints
- Time limit: 180 seconds
- Compare each chart against its source data
`;

export const chartForensicsModule: ChallengeModule = {
  slug: "chart-forensics",
  dimensions: CHART_FORENSICS_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      issues: "[{ chart_id: string, issue_type: string, description: string }]",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: CHART_FORENSICS_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateForensicsData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreForensics(input);
  },

  validateSubmission(submission: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];

    // Detect old format: agent used `findings` instead of `issues`
    if (!("issues" in submission) && "findings" in submission) {
      warnings.push({
        severity: "error",
        field: "issues",
        message: 'Submit "issues" not "findings". Each issue needs { chart_id, issue_type, description }. Valid issue_type values: wrong_height, swapped_label, misleading_scale, missing_data, wrong_value.',
      });
      return warnings;
    }

    if (!("issues" in submission) || !Array.isArray(submission.issues)) {
      warnings.push({
        severity: "error",
        field: "issues",
        message: 'Missing "issues" array. Submit { issues: [{ chart_id, issue_type, description }] }.',
      });
      return warnings;
    }

    const issues = submission.issues as Array<Record<string, unknown>>;

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];

      if (!issue.chart_id) {
        warnings.push({
          severity: "error",
          field: `issues[${i}].chart_id`,
          message: `Issue at index ${i} is missing "chart_id". Each issue must specify which chart it refers to.`,
        });
      }

      if (!issue.issue_type) {
        warnings.push({
          severity: "error",
          field: `issues[${i}].issue_type`,
          message: `Issue at index ${i} is missing "issue_type". Valid values: ${VALID_ISSUE_TYPES.join(", ")}.`,
        });
      } else if (typeof issue.issue_type === "string" && !(VALID_ISSUE_TYPES as readonly string[]).includes(issue.issue_type)) {
        warnings.push({
          severity: "warning",
          field: `issues[${i}].issue_type`,
          message: `Unknown issue_type "${issue.issue_type}". Valid values: ${VALID_ISSUE_TYPES.join(", ")}. This issue won't match any ground truth.`,
        });
      }
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateForensicsData(seed);
    const files: Record<string, string> = {};
    for (const t of data.tables) {
      files[`data/${t.id}.json`] = JSON.stringify(t, null, 2);
    }
    for (const ch of data.charts) {
      files[`charts/${ch.id}.svg`] = ch.svg;
      files[`charts/${ch.id}.meta.json`] = JSON.stringify(
        { id: ch.id, table_id: ch.table_id, chart_type: ch.chart_type },
        null, 2,
      );
    }
    for (const ch of data.charts) {
      files[`descriptions/${ch.id}.txt`] = ch.description;
    }
    return files;
  },
};
