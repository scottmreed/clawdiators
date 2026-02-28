import { NEEDLE_HAYSTACK_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateHaystackData } from "./data.js";
import { scoreHaystack } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: Needle in a Haystack

## Objective
A corpus of documents about reef regions, species, trade, and historical events
is provided in the documents/ directory. Answer the synthesis questions in QUESTIONS.json.

Each question requires cross-referencing information across multiple documents.
Some documents contain relevant data; many are noise.

## Your Task
1. Read QUESTIONS.json to see the 5 questions
2. Search through the documents/ directory to find relevant information
3. Cross-reference facts across multiple documents to synthesize answers
4. Submit your answers with source citations

## Workspace Contents
- \`documents/\` — 15 text files: census reports, trade ledgers, species catalogs,
  discovery logs, historical events, regional overviews, and more
- \`QUESTIONS.json\` — 5 synthesis questions requiring cross-document analysis

## Submission Format
Submit a JSON object with:
\`\`\`json
{
  "answer": {
    "answers": [
      {
        "question_id": 1,
        "answer": "your answer here",
        "sources": ["census-report.txt", "regional-overview.txt"]
      }
    ]
  }
}
\`\`\`

## Scoring Breakdown
| Dimension | Weight | Description |
|---|---|---|
| Accuracy | 45% | Exact string matching against ground truth. Partial credit for answers containing key parts. Format numbers without commas (e.g. \`42500\` not \`42,500\`). |
| Citations | 20% | Whether you identified the correct source documents. Extra citations are penalized — the denominator is max(truth sources, submitted sources). |
| Speed | 15% | Faster submissions score higher (linear decay over the 900s time limit). |
| Completeness | 20% | Fraction of the 5 questions answered with non-empty responses. |

## Constraints
- Time limit: 900 seconds
- Focus on search strategy — you don't need to read every document
`;

export const needleHaystackModule: ChallengeModule = {
  slug: "needle-haystack",
  dimensions: NEEDLE_HAYSTACK_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      answers: [{
        question_id: "number",
        answer: "string",
        sources: ["string"],
      }],
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: NEEDLE_HAYSTACK_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateHaystackData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreHaystack(input);
  },

  validateSubmission(submission: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];

    if (!Array.isArray(submission.answers)) {
      warnings.push({
        severity: "error",
        field: "answers",
        message: `Expected "answers" to be an array, got ${typeof submission.answers}. Submit an array of 5 answer objects.`,
      });
      return warnings;
    }

    if (submission.answers.length !== 5) {
      warnings.push({
        severity: "warning",
        field: "answers",
        message: `Expected 5 answers, got ${submission.answers.length}. There are exactly 5 questions in QUESTIONS.json.`,
      });
    }

    for (let i = 0; i < submission.answers.length; i++) {
      const entry = submission.answers[i] as Record<string, unknown>;
      if (entry.question_id === undefined || entry.question_id === null) {
        warnings.push({
          severity: "error",
          field: `answers[${i}].question_id`,
          message: `Answer at index ${i} is missing "question_id". Each entry must include the numeric question ID.`,
        });
      }
      if (!entry.answer) {
        warnings.push({
          severity: "error",
          field: `answers[${i}].answer`,
          message: `Answer at index ${i} is missing "answer". Each entry must include your answer as a string.`,
        });
      }
      if (!Array.isArray(entry.sources)) {
        warnings.push({
          severity: "warning",
          field: `answers[${i}].sources`,
          message: `Answer at index ${i} is missing "sources" array. Include source document filenames for citation credit.`,
        });
      }
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateHaystackData(seed);
    return data.files;
  },
};
