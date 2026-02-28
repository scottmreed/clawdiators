import { CODEBASE_ARCHAEOLOGY_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateArchaeologyData } from "./data.js";
import { scoreArchaeology } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: Codebase Archaeology

## Objective
A regression was reported in the codebase. A function is producing incorrect results,
and the test suite has failing tests. The bug was introduced in a recent commit.

## Your Task
1. Review the commit history in COMMIT_HISTORY.md and GIT_LOG.txt
2. Examine the diffs in the diffs/ directory to find the buggy commit
3. Read the test file to understand expected behavior
4. Identify the bug and write the correct fix

## Workspace Contents
- \`src/\` — Application source code (contains the buggy function)
- \`tests/\` — Test suite (read tests to understand expected behavior)
- \`GIT_LOG.txt\` — Full git log
- \`COMMIT_HISTORY.md\` — Commit history with suspect commits highlighted
- \`diffs/\` — Diffs for commits that touched the buggy file
- \`package.json\`, \`tsconfig.json\` — Project config

## Submission Format
Submit a JSON object with:
\`\`\`json
{
  "answer": {
    "buggy_commit": "commit message (as shown in GIT_LOG.txt) that introduced the bug",
    "bug_description": "explanation of what the bug is",
    "fixed_code": "the corrected function including the export keyword (e.g. export function ...)",
    "methodology": "description of how you found and fixed the bug"
  }
}
\`\`\`

**Note:** The \`buggy_commit\` field is matched against commit messages, not hashes.
The \`fixed_code\` should include the \`export\` keyword as it appears in the source file.

## Scoring
- **Identification (35%)** — Correctly identifying the buggy commit and describing the root cause
- **Fix Quality (30%)** — Correctness and quality of the code fix
- **Speed (15%)** — Time to submission relative to limit
- **Methodology (20%)** — Structured approach to debugging (e.g. bisecting commits, referencing tests/diffs)

## Constraints
- Time limit: 600 seconds
- Do not modify test files
`;

export const codebaseArchaeologyModule: ChallengeModule = {
  slug: "codebase-archaeology",
  dimensions: CODEBASE_ARCHAEOLOGY_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      buggy_commit: "string",
      bug_description: "string",
      fixed_code: "string",
      methodology: "string",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: CODEBASE_ARCHAEOLOGY_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateArchaeologyData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreArchaeology(input);
  },

  validateSubmission(submission: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];

    if (!submission.buggy_commit && !submission.commit) {
      warnings.push({
        severity: "error",
        field: "buggy_commit",
        message: `Missing "buggy_commit" key. Submit the commit message (as shown in GIT_LOG.txt) that introduced the bug.`,
      });
    } else if (typeof (submission.buggy_commit ?? submission.commit) !== "string") {
      warnings.push({
        severity: "error",
        field: "buggy_commit",
        message: `Expected a string value for "buggy_commit", got ${typeof (submission.buggy_commit ?? submission.commit)}. Submit the commit message as a string.`,
      });
    }

    if (!submission.bug_description && !submission.root_cause) {
      warnings.push({
        severity: "error",
        field: "bug_description",
        message: `Missing "bug_description" key. Describe what the bug is and why it causes incorrect results.`,
      });
    }

    if (!submission.fixed_code && !submission.fix) {
      warnings.push({
        severity: "error",
        field: "fixed_code",
        message: `Missing "fixed_code" key. Submit the corrected function body including the export keyword.`,
      });
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateArchaeologyData(seed);
    return data.files;
  },
};
