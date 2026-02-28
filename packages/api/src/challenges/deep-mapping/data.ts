import { mulberry32 } from "../../services/whimsy.js";

/**
 * Deep Mapping Expedition: Explore a procedural graph (ocean floor).
 * Agent discovers nodes via workspace file reads.
 * Must map territory, find resources, plan efficient paths under oxygen budget.
 */

export interface MapEdge {
  target: string;
  energy: number;
  oneWay: boolean;
}

export interface MapNode {
  id: string;
  name: string;
  type: "cave" | "reef" | "trench" | "plateau" | "vent" | "ruin";
  biome: string;
  depth: number;
  resource: string | null;
  resourceValue: number;
  connections: MapEdge[];
  discoverable: boolean;
}

export interface MappingGroundTruth {
  totalNodes: number;
  totalResources: number;
  totalResourceValue: number;
  deepestNode: { id: string; depth: number };
  mostConnectedNode: { id: string; connections: number };
  resourcesByType: Record<string, { count: number; totalValue: number }>;
  optimalPath: string[];
  optimalPathValue: number;
  oxygenBudget: number;
  biomeTypes: string[];
  planningStart: string;
  planningEnd: string;
  planningOptimalPath: string[];
  planningOptimalEnergy: number;
  planningOptimalBiomes: number;
  graph: Record<string, {
    biome: string;
    resourceValue: number;
    connections: Array<{ target: string; energy: number }>;
  }>;
}

export interface MappingData {
  nodes: MapNode[];
  startNodeId: string;
  groundTruth: MappingGroundTruth;
  objective: string;
}

const NODE_NAMES = [
  "The Abyss Gate", "Coral Throne", "Phantom Ridge", "Biolume Cavern",
  "Pressure Point", "The Silent Deep", "Kelp Cathedral", "Iron Trench",
  "Crystal Spire", "The Maw", "Starfall Basin", "Obsidian Shelf",
  "Thermal Vent Alpha", "The Graveyard", "Sapphire Grotto", "Riftwall",
  "Echo Chamber", "Tide Pool", "Barnacle Heights", "The Narrows",
  "Leviathan's Rest", "Glass Floor", "Sulfur Springs", "Anchor Point",
  "The Crucible", "Midnight Garden", "Storm Drain", "Pearl Bed",
  "The Labyrinth", "Driftwood Hollow", "Mariana's Edge", "Sunken Citadel",
  "Coral Bridge", "Brine Lake", "The Cascade", "Chimney Field",
  "Twilight Zone", "Abyssopelagic Flat", "Hydrothermal Rise", "Fossil Terrace",
  "Serpent's Coil", "The Undercroft", "Luminous Shelf", "Blackwater Basin",
  "Needlefish Pass", "Silt Canyon", "The Iron Garden", "Whalefall Mesa",
  "Volcanic Lip", "Frozen Vent", "Phosphor Hollow", "Current's Edge",
  "The Crevasse", "Manganese Ridge", "Tube Worm Spire", "Salinity Front",
  "The Doldrums", "Pelagic Terrace", "Abyssal Knoll", "The Chasm",
  "Bioluminescent Trench", "Coral Labyrinth", "Deep Forge Basin", "Tidal Lock",
  "Hermit's Alcove", "Cetacean Hall", "The Boiling Point", "Cobalt Shelf",
  "Nautilus Arch", "Polychaete Thicket", "Silica Dunes", "The Dead Zone",
  "Rimstone Pool", "Current Nexus", "The Grotto of Echoes", "Manganese Falls",
  "Pyroclast Field", "Anemone Terrace", "The Throat", "Hadal Flat",
  "Ophiolite Ridge", "Basalt Colosseum", "Geyser Row", "Urchin Plateau",
  "The Sunken Archive", "Trilobite Ledge", "Halite Cavern", "The Spillway",
  "Isopod Trench", "Crinoid Garden", "The Drowned Tower", "Sulfide Chimney",
  "Benthic Plaza", "Radiolarian Ooze", "The Fault Line", "Glass Sponge Forest",
  "Hydrate Ridge", "Pearlescent Grotto", "The Maelstrom", "Abyssal Staircase",
  "Chitin Reef", "Brine Cascade", "Lava Tube Gamma", "Phosphorite Shelf",
  "The Iron Curtain", "Whale Bone Alley", "Polymetallic Field", "Cusk Eel Pass",
  "The Luminous Pit", "Gorgonian Heights", "Methane Seep", "Deep Current Bend",
  "The Reliquary", "Tremor Ridge", "Opal Basin", "Depth Marker 9000",
];

const NODE_TYPES: MapNode["type"][] = ["cave", "reef", "trench", "plateau", "vent", "ruin"];
const RESOURCES = ["crystal", "fossil", "mineral", "artifact"];
const BIOME_TYPES = [
  "kelp_forest", "coral_reef", "hydrothermal_field", "abyssal_plain",
  "volcanic_ridge", "brine_pool", "seamount", "ice_shelf",
];

export function generateMappingData(seed: number): MappingData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const nodeCount = randInt(80, 120);
  const nodes: MapNode[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const hasResource = rng() > 0.4;
    const resource = hasResource ? pick(RESOURCES) : null;
    const resourceValue = resource ? randInt(10, 100) * (resource === "artifact" ? 3 : resource === "crystal" ? 2 : 1) : 0;
    const depth = randInt(100, 10000);

    nodes.push({
      id: `NODE-${String(i + 1).padStart(3, "0")}`,
      name: i < NODE_NAMES.length ? NODE_NAMES[i] : `Unnamed Sector ${i + 1}`,
      type: pick(NODE_TYPES),
      biome: pick(BIOME_TYPES),
      depth,
      resource,
      resourceValue,
      connections: [],
      discoverable: i > 5 ? rng() > 0.3 : true,
    });
  }

  // ── Build graph edges ──────────────────────────────────────────
  // Spanning tree first (bidirectional) to ensure full connectivity
  for (let i = 1; i < nodeCount; i++) {
    const parent = randInt(0, i - 1);
    const energy = computeEnergy(nodes[i].depth, nodes[parent].depth, rng);
    nodes[i].connections.push({ target: nodes[parent].id, energy, oneWay: false });
    nodes[parent].connections.push({ target: nodes[i].id, energy, oneWay: false });
  }

  // Extra edges for richness
  const extraEdges = randInt(nodeCount, nodeCount * 2);
  for (let e = 0; e < extraEdges; e++) {
    const a = randInt(0, nodeCount - 1);
    const b = randInt(0, nodeCount - 1);
    if (a === b) continue;
    if (nodes[a].connections.some(c => c.target === nodes[b].id)) continue;

    const energy = computeEnergy(nodes[a].depth, nodes[b].depth, rng);
    const isOneWay = rng() < 0.25; // 25% of extra edges are one-directional

    if (isOneWay) {
      nodes[a].connections.push({ target: nodes[b].id, energy, oneWay: true });
    } else {
      nodes[a].connections.push({ target: nodes[b].id, energy, oneWay: false });
      nodes[b].connections.push({ target: nodes[a].id, energy, oneWay: false });
    }
  }

  // ── Compute ground truth ───────────────────────────────────────
  let deepestNode = nodes[0];
  let mostConnected = nodes[0];
  const resourcesByType: Record<string, { count: number; totalValue: number }> = {};
  let totalResources = 0;
  let totalResourceValue = 0;

  for (const node of nodes) {
    if (node.depth > deepestNode.depth) deepestNode = node;
    if (node.connections.length > mostConnected.connections.length) mostConnected = node;
    if (node.resource) {
      totalResources++;
      totalResourceValue += node.resourceValue;
      if (!resourcesByType[node.resource]) {
        resourcesByType[node.resource] = { count: 0, totalValue: 0 };
      }
      resourcesByType[node.resource].count++;
      resourcesByType[node.resource].totalValue += node.resourceValue;
    }
  }

  // Greedy optimal path (from start, always go to highest-value unvisited neighbor)
  const startNode = nodes[0];
  const visited = new Set<string>();
  const optimalPath: string[] = [startNode.id];
  let optimalPathValue = startNode.resourceValue;
  visited.add(startNode.id);

  let current = startNode;
  for (let step = 0; step < 20; step++) {
    const neighbors = current.connections
      .map((edge) => nodes.find((n) => n.id === edge.target)!)
      .filter((n) => n && !visited.has(n.id));

    if (neighbors.length === 0) break;

    neighbors.sort((a, b) => b.resourceValue - a.resourceValue);
    current = neighbors[0];
    visited.add(current.id);
    optimalPath.push(current.id);
    optimalPathValue += current.resourceValue;
  }

  // ── Oxygen budget and planning question ────────────────────────
  // Budget is enough to visit ~20-30 nodes along typical paths
  const avgEnergy = computeAverageEnergy(nodes);
  const oxygenBudget = Math.round(avgEnergy * 25);

  // Pick planning endpoints: start node and a distant node (by hops)
  const planningStart = startNode.id;
  const planningEndNode = findDistantNode(nodes, startNode.id, rng);
  const planningEnd = planningEndNode.id;

  // Compute planning optimal: path from start to end maximizing unique biomes under budget
  const planningResult = solvePlanningQuestion(nodes, planningStart, planningEnd, oxygenBudget);

  const biomeTypes = [...new Set(nodes.map(n => n.biome))].sort();

  const objective = `Explore an underwater cave system starting from "${startNode.name}" (${startNode.id}). ` +
    `Read node files to discover connections, map the territory, and find resources. ` +
    `Each connection has an energy cost that varies by depth difference between nodes. ` +
    `Some connections are one-way only (representing currents). ` +
    `You have an oxygen budget of ${oxygenBudget} energy units — plan your exploration efficiently. ` +
    `Report: total nodes discovered, resources found by type, deepest node, most connected node, ` +
    `your best resource-collecting path, and a planning path from ${planningStart} to ${planningEnd} ` +
    `that maximizes unique biome types visited while staying within the oxygen budget.`;

  return {
    nodes,
    startNodeId: startNode.id,
    groundTruth: {
      totalNodes: nodeCount,
      totalResources,
      totalResourceValue,
      deepestNode: { id: deepestNode.id, depth: deepestNode.depth },
      mostConnectedNode: { id: mostConnected.id, connections: mostConnected.connections.length },
      resourcesByType,
      optimalPath,
      optimalPathValue,
      oxygenBudget,
      biomeTypes,
      planningStart,
      planningEnd,
      planningOptimalPath: planningResult.path,
      planningOptimalEnergy: planningResult.energy,
      planningOptimalBiomes: planningResult.biomes,
      graph: Object.fromEntries(nodes.map((n) => [
        n.id,
        {
          biome: n.biome,
          resourceValue: n.resourceValue,
          connections: n.connections.map((c) => ({ target: c.target, energy: c.energy })),
        },
      ])),
    },
    objective,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function computeEnergy(depthA: number, depthB: number, rng: () => number): number {
  const depthDiff = Math.abs(depthA - depthB);
  const base = 10 + Math.floor(rng() * 20);
  const depthCost = Math.floor(depthDiff / 100);
  return base + depthCost;
}

function computeAverageEnergy(nodes: MapNode[]): number {
  let total = 0;
  let count = 0;
  for (const node of nodes) {
    for (const edge of node.connections) {
      total += edge.energy;
      count++;
    }
  }
  return count > 0 ? total / count : 30;
}

function findDistantNode(nodes: MapNode[], startId: string, rng: () => number): MapNode {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const distances = new Map<string, number>();
  const queue = [startId];
  distances.set(startId, 0);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const node = nodeMap.get(curr)!;
    const dist = distances.get(curr)!;
    for (const edge of node.connections) {
      if (!distances.has(edge.target)) {
        distances.set(edge.target, dist + 1);
        queue.push(edge.target);
      }
    }
  }

  // Pick a node at >60% of max distance
  const maxDist = Math.max(...distances.values());
  const threshold = Math.floor(maxDist * 0.6);
  const candidates = nodes.filter(n => (distances.get(n.id) ?? 0) >= threshold && n.id !== startId);
  if (candidates.length === 0) return nodes[nodes.length - 1];
  return candidates[Math.floor(rng() * candidates.length)];
}

interface PlanningResult {
  path: string[];
  energy: number;
  biomes: number;
}

function solvePlanningQuestion(
  nodes: MapNode[],
  startId: string,
  endId: string,
  budget: number,
): PlanningResult {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  let best: PlanningResult = { path: [], energy: 0, biomes: 0 };

  // BFS to find shortest-energy path first (baseline)
  const baseline = findShortestEnergyPath(nodeMap, startId, endId);
  if (baseline && baseline.energy <= budget) {
    const biomes = new Set(baseline.path.map(id => nodeMap.get(id)!.biome));
    best = { path: baseline.path, energy: baseline.energy, biomes: biomes.size };
  }

  // Bounded DFS to find a better path (more biomes)
  const maxDepth = 15;
  let iterations = 0;
  const maxIterations = 50000;

  function dfs(
    nodeId: string,
    path: string[],
    energyUsed: number,
    biomeCounts: Map<string, number>,
    visited: Set<string>,
  ) {
    if (++iterations > maxIterations) return;

    if (nodeId === endId && path.length > 1) {
      const biomeCount = biomeCounts.size;
      if (biomeCount > best.biomes || (biomeCount === best.biomes && energyUsed < best.energy)) {
        best = { path: [...path], energy: energyUsed, biomes: biomeCount };
      }
      // Don't return — allow continuing through endId if budget allows
    }

    if (path.length >= maxDepth) return;

    const node = nodeMap.get(nodeId)!;
    for (const edge of node.connections) {
      if (visited.has(edge.target)) continue;
      const newEnergy = energyUsed + edge.energy;
      if (newEnergy > budget) continue;

      const targetNode = nodeMap.get(edge.target)!;
      visited.add(edge.target);
      path.push(edge.target);
      const prevCount = biomeCounts.get(targetNode.biome) ?? 0;
      biomeCounts.set(targetNode.biome, prevCount + 1);

      dfs(edge.target, path, newEnergy, biomeCounts, visited);

      path.pop();
      visited.delete(edge.target);
      if (prevCount === 0) biomeCounts.delete(targetNode.biome);
      else biomeCounts.set(targetNode.biome, prevCount);
    }
  }

  const startBiome = nodeMap.get(startId)!.biome;
  const initialBiomes = new Map<string, number>([[startBiome, 1]]);
  dfs(startId, [startId], 0, initialBiomes, new Set([startId]));

  // If no path found at all, return empty result
  if (best.path.length === 0 && baseline) {
    const biomes = new Set(baseline.path.map(id => nodeMap.get(id)!.biome));
    return { path: baseline.path, energy: baseline.energy, biomes: biomes.size };
  }

  return best;
}

function findShortestEnergyPath(
  nodeMap: Map<string, MapNode>,
  startId: string,
  endId: string,
): { path: string[]; energy: number } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  dist.set(startId, 0);

  // Simple Dijkstra with array-based priority queue (adequate for ~120 nodes)
  const pq: Array<{ id: string; cost: number }> = [{ id: startId, cost: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id: curr, cost } = pq.shift()!;
    if (cost > (dist.get(curr) ?? Infinity)) continue;

    if (curr === endId) {
      const path: string[] = [];
      let node: string | undefined = endId;
      while (node !== undefined) {
        path.unshift(node);
        node = prev.get(node);
      }
      return { path, energy: cost };
    }

    const node = nodeMap.get(curr)!;
    for (const edge of node.connections) {
      const newCost = cost + edge.energy;
      if (newCost < (dist.get(edge.target) ?? Infinity)) {
        dist.set(edge.target, newCost);
        prev.set(edge.target, curr);
        pq.push({ id: edge.target, cost: newCost });
      }
    }
  }

  return null;
}
