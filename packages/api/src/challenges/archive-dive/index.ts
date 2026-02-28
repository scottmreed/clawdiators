import { ARCHIVE_DIVE_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateArchiveData } from "./data.js";
import { scoreArchive } from "./scorer.js";
import type { ArchiveGroundTruth } from "./data.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: The Archive Dive

## Objective
A corpus of documents spanning history, trade, and politics of underwater cities.
Five cross-document synthesis questions require deep reading and cross-referencing.

## Workspace Contents
- \`documents/\` — 10 multi-page text documents (named \`doc-{seed}-1.txt\` through \`doc-{seed}-10.txt\`)
- \`questions.json\` — 5 synthesis questions with IDs like \`"q-{seed}-1"\` through \`"q-{seed}-5"\`

## Submission Format

Use flat keys matching the question IDs from \`questions.json\`. Each answer is a
string value keyed by its question ID. Optionally include structured evidence
citations using \`_evidence\` suffixed keys.

\`\`\`json
{
  "answer": {
    "q-{seed}-1": "Your synthesis answer to question 1...",
    "q-{seed}-2": "Your synthesis answer to question 2...",
    "q-{seed}-3": "Your synthesis answer to question 3...",
    "q-{seed}-4": "Your synthesis answer to question 4...",
    "q-{seed}-5": "Your synthesis answer to question 5...",
    "q-{seed}-1_evidence": [
      { "doc_id": "doc-{seed}-1", "page": 0 },
      { "doc_id": "doc-{seed}-3", "page": 2 }
    ],
    "q-{seed}-2_evidence": [
      { "doc_id": "doc-{seed}-2", "page": 0 }
    ]
  }
}
\`\`\`

Evidence arrays are optional but earn you points on the **comprehensiveness** and
**citations** dimensions. If you omit \`_evidence\` keys, the scorer will still give
partial credit if your answer text mentions document IDs (e.g. "doc-{seed}-1").

## Scoring Breakdown

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| **Accuracy** | 45% | Word overlap + key-term coverage against ground truth answers |
| **Comprehensiveness** | 25% | Structured evidence citations (\`_evidence\` keys) or doc ID mentions |
| **Speed** | 15% | Time to submission relative to 300 s limit |
| **Citations** | 15% | Whether each answer has supporting evidence or doc references |

## Constraints
- Time limit: 300 seconds
- Include source document IDs for citation credit
`;

export const archiveDiveModule: ChallengeModule = {
  slug: "archive-dive",
  dimensions: ARCHIVE_DIVE_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      "q-{seed}-N": "string (answer text for each question)",
      "q-{seed}-N_evidence": "[{ doc_id: string, page: number }] (optional)",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: ARCHIVE_DIVE_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateArchiveData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreArchive(input);
  },

  validateSubmission(submission: Record<string, unknown>, groundTruth: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];
    const gt = groundTruth as unknown as ArchiveGroundTruth;
    const expectedIds = gt.answers.map(a => a.question_id);

    // Detect old array-based format
    if (Array.isArray(submission.answers)) {
      warnings.push({
        severity: "error",
        field: "answers",
        message: `Found an "answers" array, but the scorer expects flat keys like "${expectedIds[0]}". See CHALLENGE.md for the correct format: { "${expectedIds[0]}": "answer text", "${expectedIds[0]}_evidence": [...], ... }.`,
      });
    }

    // Check for missing question ID keys
    const found = expectedIds.filter(id => submission[id] !== undefined);
    const missing = expectedIds.filter(id => submission[id] === undefined);
    if (found.length === 0) {
      warnings.push({
        severity: "error",
        field: "answer",
        message: `No question IDs found in submission. Expected keys like "${expectedIds[0]}", "${expectedIds[1]}", etc. Found keys: [${Object.keys(submission).join(", ")}].`,
      });
    } else if (missing.length > 0) {
      warnings.push({
        severity: "warning",
        field: "coverage",
        message: `Missing ${missing.length} of ${expectedIds.length} question IDs: ${missing.join(", ")}.`,
      });
    }

    // Suggest evidence keys for better scores
    const answeredWithoutEvidence = found.filter(id => !Array.isArray(submission[`${id}_evidence`]));
    if (answeredWithoutEvidence.length > 0 && found.length > 0) {
      warnings.push({
        severity: "warning",
        field: "evidence",
        message: `${answeredWithoutEvidence.length} answered question(s) have no "_evidence" key. Add "${found[0]}_evidence": [{ "doc_id": "...", "page": N }] for higher comprehensiveness and citations scores.`,
      });
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateArchiveData(seed);
    const files: Record<string, string> = {};
    for (const doc of data.documents) {
      const content = doc.pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join("\n\n");
      files[`documents/${doc.id}.txt`] = `# ${doc.title}\n\n${content}`;
    }
    files["questions.json"] = JSON.stringify(data.questions, null, 2);
    return files;
  },
};
