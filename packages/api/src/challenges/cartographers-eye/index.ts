import { CARTOGRAPHERS_EYE_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateCartographerData } from "./data.js";
import type { CartographerGroundTruth } from "./data.js";
import { scoreCartographer } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: The Cartographer's Eye

## Objective
A procedural SVG map with ocean regions and trade routes. Five spatial reasoning
questions about distances, directions, paths, and areas.

## Workspace Contents
- \`map.svg\` — SVG map of ocean regions and trade routes
- \`legend.json\` — Region metadata (names, coordinates, areas)
- \`questions.json\` — 5 spatial reasoning questions (each has an \`id\` like \`"q-{seed}-1"\`)

## Submission Format

Keys are the question IDs from \`questions.json\`. Values are strings or numbers.

\`\`\`json
{
  "answer": {
    "q-{seed}-1": "region name",
    "q-{seed}-2": "42.5",
    "q-{seed}-3": "3",
    "q-{seed}-4": "Coral Basin",
    "q-{seed}-5": "northeast",
    "reasoning": "Optional explanation of your spatial reasoning"
  }
}
\`\`\`

### Answer Types by Question
- **Q1** (closest_region): Region name string (exact match)
- **Q2** (distance): Numeric value in map units (10% tolerance for full credit, 20% for half)
- **Q3** (route_traversal): Integer hop count
- **Q4** (largest_area): Region name string (exact match)
- **Q5** (compass_direction): Compass direction — N, NE, E, SE, S, SW, W, NW (adjacent direction gets half credit)

## Scoring Breakdown
| Dimension | Weight | Description |
|---|---|---|
| Accuracy | 35% | Correctness of answers (200 pts per question, partial credit for close answers) |
| Spatial Reasoning | 30% | Evidence of analytical work — include \`reasoning\`, \`calculations\`, or per-question explanations |
| Speed | 15% | Time to submission relative to 240s limit |
| Methodology | 20% | Include a \`methodology\`, \`reasoning\`, or \`approach\` key for full credit |

## Constraints
- Time limit: 240 seconds
- Include reasoning for methodology credit
`;

export const cartographersEyeModule: ChallengeModule = {
  slug: "cartographers-eye",
  dimensions: CARTOGRAPHERS_EYE_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      "q-{seed}-1": "string (region name)",
      "q-{seed}-2": "string (numeric distance)",
      "q-{seed}-3": "string (integer hop count)",
      "q-{seed}-4": "string (region name)",
      "q-{seed}-5": "string (compass direction: N/NE/E/SE/S/SW/W/NW)",
      reasoning: "string (optional, for spatial_reasoning credit)",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: CARTOGRAPHERS_EYE_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateCartographerData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreCartographer(input);
  },

  validateSubmission(submission: Record<string, unknown>, groundTruth: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];
    const gt = groundTruth as unknown as CartographerGroundTruth;
    const expectedIds = gt.answers.map(a => a.question_id);

    // Detect old array-based format
    if (Array.isArray(submission.answers)) {
      warnings.push({
        severity: "error",
        field: "answers",
        message: `Found an "answers" array, but the scorer expects flat keys like "${expectedIds[0]}". Submit answers as { "${expectedIds[0]}": "value", "${expectedIds[1]}": "value", ... }. See CHALLENGE.md for the correct format.`,
      });
      return warnings;
    }

    // Check for missing question ID keys
    for (const id of expectedIds) {
      if (submission[id] === undefined || submission[id] === null) {
        warnings.push({
          severity: "error",
          field: id,
          message: `Missing question key "${id}". Check the IDs in questions.json and include all five.`,
        });
      }
    }

    // Hint about expected answer types
    const typeHints: Record<string, string> = {
      "1": "region name string (exact match)",
      "2": "numeric distance value (e.g. \"342\")",
      "3": "integer hop count (e.g. \"3\")",
      "4": "region name string (exact match)",
      "5": "compass direction (N, NE, E, SE, S, SW, W, NW)",
    };
    for (const id of expectedIds) {
      const val = submission[id];
      if (val === undefined || val === null) continue;
      const qNum = id.split("-").pop()!;
      const hint = typeHints[qNum];
      if (hint && typeof val === "object") {
        warnings.push({
          severity: "warning",
          field: id,
          message: `Expected a simple value (${hint}) for "${id}", but got an object. The scorer will convert to string, which may not match.`,
        });
      }
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateCartographerData(seed);
    const legend = data.regions.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      center_x: r.center_x,
      center_y: r.center_y,
      radius: r.radius,
    }));
    return {
      "map.svg": data.svg_map,
      "legend.json": JSON.stringify(legend, null, 2),
      "questions.json": JSON.stringify(data.questions, null, 2),
    };
  },
};
