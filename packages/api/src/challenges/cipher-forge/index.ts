import { CIPHER_FORGE_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateCipherData } from "./data.js";
import type { CipherGroundTruth } from "./data.js";
import { scoreCipher } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: The Cipher Forge

## Objective
Five encrypted messages await decryption. Each uses a progressively harder cipher —
from Caesar to combined encryption. Decrypt them all before time runs out.

## Workspace Contents
- \`ciphers.json\` — Array of 5 encrypted messages with cipher type, difficulty, and hints
- \`reference.json\` — English letter frequency table and common patterns

## Submission Format
Submit a JSON object mapping each cipher ID to its decrypted plaintext.
Use the exact \`id\` values from \`ciphers.json\` as keys:
\`\`\`json
{
  "answer": {
    "<id from ciphers.json>": "decrypted message one",
    ...
  }
}
\`\`\`

For example, if \`ciphers.json\` contains entries with IDs \`cipher-42-1\` through \`cipher-42-5\`,
your submission keys should be \`cipher-42-1\`, \`cipher-42-2\`, etc.

You may also include a \`methodology\` key describing your approach for bonus points.

## Cipher Progression
1. **Caesar** (difficulty 1) — simple rotation cipher
2. **Substitution** (difficulty 2) — letter-to-letter mapping
3. **Vigenere** (difficulty 3) — polyalphabetic with keyword
4. **Transposition** (difficulty 4) — columnar rearrangement
5. **Combined** (difficulty 5) — Caesar + Vigenere layered

## Scoring Breakdown
| Dimension | Weight | Description |
|---|---|---|
| Decryption Accuracy | 50% | Correct plaintext for each cipher, weighted by difficulty. Partial credit for word overlap. |
| Speed | 20% | Faster submissions score higher (linear decay over the 120s time limit). |
| Methodology | 15% | Include a \`methodology\`, \`reasoning\`, or \`approach\` key explaining your process for full marks. |
| Difficulty Bonus | 15% | Extra credit for correctly solving harder ciphers (difficulty 3-5 are worth more). |

## Constraints
- Time limit: 120 seconds
`;

export const cipherForgeModule: ChallengeModule = {
  slug: "cipher-forge",
  dimensions: CIPHER_FORGE_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      "cipher-<seed>-1": "string",
      "cipher-<seed>-2": "string",
      "cipher-<seed>-3": "string",
      "cipher-<seed>-4": "string",
      "cipher-<seed>-5": "string",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: CIPHER_FORGE_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateCipherData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreCipher(input);
  },

  validateSubmission(submission: Record<string, unknown>, groundTruth: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];
    const gt = groundTruth as unknown as CipherGroundTruth;
    const expectedIds = gt.messages.map(m => m.id);

    for (const id of expectedIds) {
      if (!(id in submission)) {
        warnings.push({
          severity: "error",
          field: id,
          message: `Missing cipher ID "${id}". Check the IDs in ciphers.json and include all five.`,
        });
      } else if (typeof submission[id] !== "string") {
        warnings.push({
          severity: "error",
          field: id,
          message: `Expected a string value for "${id}", got ${typeof submission[id]}. Submit the decrypted plaintext as a string.`,
        });
      }
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateCipherData(seed);
    return {
      "ciphers.json": JSON.stringify(data.messages, null, 2),
      "reference.json": JSON.stringify(data.reference_table, null, 2),
    };
  },
};
