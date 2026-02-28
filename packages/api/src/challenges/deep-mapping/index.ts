import { DEEP_MAPPING_DIMENSIONS } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult, SubmissionWarning } from "../types.js";
import { generateMappingData } from "./data.js";
import { scoreMapping } from "./scorer.js";

const CHALLENGE_MD_TEMPLATE = `# Challenge: The Deep Mapping Expedition

## Objective
Explore a procedural ocean floor graph. Discover nodes, find resources, and map
optimal paths through the territory.

## Workspace Contents
- \`map/\` — Node files as JSON, each revealing connections to neighbors
- \`start.json\` — Starting node with initial connections

## How to Explore
Read node files to discover their connections and resources. Each node file contains:
- Node ID, depth, resources, and connections to neighboring nodes
- Neighboring node filenames that you can read to continue exploration

## Submission Format
\`\`\`json
{
  "answer": {
    "total_nodes": 35,
    "deepest_node": "NODE-023",
    "most_connected_node": "NODE-005",
    "resources_by_type": { "crystal": 5, "fossil": 3, "mineral": 4, "artifact": 2 },
    "total_resource_value": 12500,
    "explored_nodes": ["NODE-001", "NODE-002", "..."],
    "best_path": ["NODE-001", "NODE-005", "NODE-012"],
    "path_value": 8500
  }
}
\`\`\`

### Field Reference
| Field | Type | Description |
|---|---|---|
| \`total_nodes\` | number | Total number of nodes you discovered in the map |
| \`deepest_node\` | string | ID of the node with the greatest depth value |
| \`most_connected_node\` | string | ID of the node with the most connections |
| \`resources_by_type\` | object | Count of resources found per type (crystal, fossil, mineral, artifact) |
| \`total_resource_value\` | number | Sum of all resource values across discovered nodes |
| \`explored_nodes\` | string[] | List of all node IDs you visited |
| \`best_path\` | string[] | Ordered list of node IDs forming your best resource-collecting path |
| \`path_value\` | number | Total resource value collected along your best path |

## Scoring Breakdown
| Dimension | Weight | What is measured |
|---|---|---|
| Coverage | 35% | Proportion of total nodes discovered |
| Accuracy | 30% | Correct identification of deepest node, most connected node, resource counts, and total resource value |
| Exploration | 20% | Quality of your best path relative to the optimal path value |
| Strategy | 15% | Exploration efficiency — ratio of unique nodes to total visits |

## Constraints
- Time limit: 3600 seconds (1 hour)
- Explore by reading node files — each file reveals neighboring connections
`;

export const deepMappingModule: ChallengeModule = {
  slug: "deep-mapping",
  dimensions: DEEP_MAPPING_DIMENSIONS,

  workspaceSpec: {
    type: "generator",
    seedable: true,
    challengeMd: CHALLENGE_MD_TEMPLATE,
  },

  submissionSpec: {
    type: "json",
    schema: {
      total_nodes: "number",
      deepest_node: "string",
      most_connected_node: "string",
      resources_by_type: "Record<string, number>",
      total_resource_value: "number",
      explored_nodes: "string[]",
      best_path: "string[]",
      path_value: "number",
    },
  },

  scoringSpec: {
    method: "deterministic",
    dimensions: DEEP_MAPPING_DIMENSIONS,
    maxScore: 1000,
  },

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateMappingData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreMapping(input);
  },

  validateSubmission(submission: Record<string, unknown>): SubmissionWarning[] {
    const warnings: SubmissionWarning[] = [];

    // Check for missing key fields
    const keyFields = ["total_nodes", "deepest_node", "most_connected_node", "resources_by_type"] as const;
    for (const field of keyFields) {
      if (submission[field] === undefined) {
        warnings.push({
          severity: "error",
          field,
          message: `Missing required field "${field}". See CHALLENGE.md for the full submission schema.`,
        });
      }
    }

    // Migration advice: old "resources" key → new "resources_by_type"
    if (submission.resources !== undefined && submission.resources_by_type === undefined) {
      warnings.push({
        severity: "warning",
        field: "resources",
        message: `"resources" is not a scored field. Use "resources_by_type" instead — an object mapping resource type names to their counts (e.g. { "crystal": 5, "fossil": 3 }).`,
      });
    }

    // Migration advice: old "total_value" key → new "total_resource_value"
    if (submission.total_value !== undefined && submission.total_resource_value === undefined) {
      warnings.push({
        severity: "warning",
        field: "total_value",
        message: `"total_value" is not a scored field. Use "total_resource_value" instead — the sum of all resource values across discovered nodes.`,
      });
    }

    return warnings;
  },

  generateWorkspace(seed: number, _config: Record<string, unknown>): Record<string, string> {
    const data = generateMappingData(seed);
    const files: Record<string, string> = {};
    // Start file shows the first node
    const startNode = data.nodes[0];
    files["start.json"] = JSON.stringify({
      start_node: startNode.id,
      message: "Begin your expedition from this node. Read map files to explore.",
    }, null, 2);
    // Each node as a separate file
    for (const node of data.nodes) {
      files[`map/${node.id}.json`] = JSON.stringify({
        id: node.id,
        depth: node.depth,
        resource: node.resource,
        resource_value: node.resourceValue,
        connections: node.connections,
      }, null, 2);
    }
    return files;
  },
};
