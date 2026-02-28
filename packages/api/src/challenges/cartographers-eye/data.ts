import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ──────────────────────────────────────────────────────

export interface OceanRegion {
  id: string;
  name: string;
  center_x: number;
  center_y: number;
  radius: number;
  type: string;
  color: string;
}

export interface TradeRoute {
  id: string;
  from_region: string;
  to_region: string;
}

export interface ObstacleZone {
  id: string;
  name: string;
  center_x: number;
  center_y: number;
  radius: number;
}

export interface SpatialQuestion {
  id: string;
  question: string;
  type: string;
}

export interface CartographerGroundTruth {
  answers: Array<{
    question_id: string;
    answer: string | number;
    explanation: string;
  }>;
  regions: OceanRegion[];
}

export interface CartographerData {
  regions: OceanRegion[];
  routes: TradeRoute[];
  obstacles: ObstacleZone[];
  svg_map: string;
  questions: SpatialQuestion[];
  groundTruth: CartographerGroundTruth;
  objective: string;
}

// ── Data pools ──────────────────────────────────────────────────────

const REGION_NAMES = [
  "Coral Expanse",
  "Abyssal Trench",
  "Kelp Forest",
  "Thermal Basin",
  "Pearl Shallows",
  "Obsidian Depths",
  "Brine Flats",
  "Crystal Caverns",
  "Storm Reach",
  "Twilight Drift",
  "Ember Reef",
  "Frost Channel",
  "Sapphire Shelf",
  "Magma Vent",
  "Glacial Hollow",
  "Sunken Plateau",
  "Serpent Trench",
  "Tidal Forge",
  "Crimson Caldera",
  "Azure Abyss",
  "Phantom Grotto",
  "Iron Depths",
];

const REGION_TYPES = ["shallow", "deep", "volcanic", "arctic", "coastal"];

const FILL_COLORS: Record<string, string> = {
  shallow: "rgba(74,217,144,0.3)",
  deep: "rgba(74,90,217,0.3)",
  volcanic: "rgba(217,74,74,0.3)",
  arctic: "rgba(180,220,255,0.3)",
  coastal: "rgba(217,180,74,0.3)",
};

const OBSTACLE_NAMES = [
  "Maelstrom Vortex",
  "Dead Water Zone",
  "Kraken Territory",
  "Toxic Bloom",
  "Ice Shelf Barrier",
];

// ── Geometry helpers ────────────────────────────────────────────────

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function euclideanRegion(a: OceanRegion, b: OceanRegion): number {
  return euclidean(a.center_x, a.center_y, b.center_x, b.center_y);
}

function compassDirection(from: OceanRegion, to: OceanRegion): string {
  const dx = to.center_x - from.center_x;
  const dy = from.center_y - to.center_y; // SVG y-axis is inverted
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized < 22.5 || normalized >= 337.5) return "N";
  if (normalized < 67.5) return "NE";
  if (normalized < 112.5) return "E";
  if (normalized < 157.5) return "SE";
  if (normalized < 202.5) return "S";
  if (normalized < 247.5) return "SW";
  if (normalized < 292.5) return "W";
  return "NW";
}

function buildAdjacency(
  regions: OceanRegion[],
  routes: TradeRoute[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const r of regions) adj.set(r.id, []);
  for (const route of routes) {
    adj.get(route.from_region)!.push(route.to_region);
    adj.get(route.to_region)!.push(route.from_region);
  }
  return adj;
}

/** BFS shortest path on the trade-route graph (returns hop count). */
function shortestPath(
  adj: Map<string, string[]>,
  startId: string,
  endId: string,
): number | null {
  const visited = new Set<string>();
  const queue: Array<{ id: string; hops: number }> = [
    { id: startId, hops: 0 },
  ];
  visited.add(startId);

  while (queue.length > 0) {
    const { id, hops } = queue.shift()!;
    if (id === endId) return hops;
    for (const neighbor of adj.get(id) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, hops: hops + 1 });
      }
    }
  }
  return null;
}

/** BFS reachable set from a starting node. */
function reachableFrom(
  adj: Map<string, string[]>,
  startId: string,
): Set<string> {
  const visited = new Set<string>();
  const queue = [startId];
  visited.add(startId);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const neighbor of adj.get(id) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

/** Minimum bounding circle radius for a set of points (simple approach). */
function boundingCircleRadius(
  points: Array<{ x: number; y: number }>,
): number {
  if (points.length === 0) return 0;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  let maxDist = 0;
  for (const p of points) {
    const d = euclidean(cx, cy, p.x, p.y);
    if (d > maxDist) maxDist = d;
  }
  return maxDist;
}

/**
 * Nearest-neighbor heuristic for TSP: visit all target nodes starting from
 * the one closest to the centroid of all targets. Returns total path distance.
 */
function tspNearestNeighbor(
  regions: OceanRegion[],
  targetIds: string[],
): number {
  if (targetIds.length <= 1) return 0;

  const targets = targetIds.map(
    (id) => regions.find((r) => r.id === id)!,
  );
  const cx = targets.reduce((s, t) => s + t.center_x, 0) / targets.length;
  const cy = targets.reduce((s, t) => s + t.center_y, 0) / targets.length;

  let startIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const d = euclidean(targets[i].center_x, targets[i].center_y, cx, cy);
    if (d < minDist) {
      minDist = d;
      startIdx = i;
    }
  }

  const visited = new Set<number>();
  visited.add(startIdx);
  let current = startIdx;
  let totalDist = 0;

  while (visited.size < targets.length) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < targets.length; i++) {
      if (visited.has(i)) continue;
      const d = euclideanRegion(targets[current], targets[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    visited.add(bestIdx);
    totalDist += bestDist;
    current = bestIdx;
  }
  return Math.round(totalDist);
}

// ── SVG generation ──────────────────────────────────────────────────

function generateMapSvg(
  regions: OceanRegion[],
  routes: TradeRoute[],
  obstacles: ObstacleZone[],
): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">`;
  svg += `<rect width="1200" height="900" fill="#1a2744"/>`;

  for (const route of routes) {
    const from = regions.find((r) => r.id === route.from_region)!;
    const to = regions.find((r) => r.id === route.to_region)!;
    svg += `<line x1="${from.center_x}" y1="${from.center_y}" x2="${to.center_x}" y2="${to.center_y}" stroke="#4A90D9" stroke-width="2" stroke-dasharray="5,5" data-route-id="${route.id}"/>`;
  }

  for (const obs of obstacles) {
    svg += `<circle cx="${obs.center_x}" cy="${obs.center_y}" r="${obs.radius}" fill="rgba(255,0,0,0.15)" stroke="#FF4444" stroke-dasharray="8,4" data-obstacle-id="${obs.id}"/>`;
    svg += `<text x="${obs.center_x}" y="${obs.center_y}" text-anchor="middle" fill="#FF6666" font-size="10">${obs.name}</text>`;
  }

  for (const r of regions) {
    svg += `<circle cx="${r.center_x}" cy="${r.center_y}" r="${r.radius}" fill="${r.color}" stroke="#4A90D9" data-region-id="${r.id}" data-region-type="${r.type}"/>`;
    svg += `<text x="${r.center_x}" y="${r.center_y}" text-anchor="middle" fill="white" font-size="11">${r.name}</text>`;
  }

  svg += `<g transform="translate(1150,50)">`;
  svg += `<text x="0" y="-20" text-anchor="middle" fill="white" font-size="14">N</text>`;
  svg += `<text x="0" y="30" text-anchor="middle" fill="white" font-size="14">S</text>`;
  svg += `<text x="-25" y="5" text-anchor="middle" fill="white" font-size="14">W</text>`;
  svg += `<text x="25" y="5" text-anchor="middle" fill="white" font-size="14">E</text>`;
  svg += `<line x1="0" y1="-15" x2="0" y2="20" stroke="white" stroke-width="1"/>`;
  svg += `<line x1="-20" y1="2" x2="20" y2="2" stroke="white" stroke-width="1"/>`;
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}

// ── Main data generator ─────────────────────────────────────────────

export function generateCartographerData(seed: number): CartographerData {
  const rng = mulberry32(seed);
  const randInt = (min: number, max: number) =>
    Math.floor(rng() * (max - min + 1)) + min;

  // Shuffle region names and pick 18
  const NUM_REGIONS = 18;
  const shuffledNames = [...REGION_NAMES];
  for (let i = shuffledNames.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledNames[i], shuffledNames[j]] = [shuffledNames[j], shuffledNames[i]];
  }
  const selectedNames = shuffledNames.slice(0, NUM_REGIONS);

  // Generate regions spread across the 1200x900 canvas
  // 6 columns x 3 rows grid with randomized offset
  const regions: OceanRegion[] = [];
  for (let i = 0; i < NUM_REGIONS; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const baseX = 100 + col * 180;
    const baseY = 150 + row * 260;
    const offsetX = randInt(-50, 50);
    const offsetY = randInt(-60, 60);
    const cx = Math.max(80, Math.min(1120, baseX + offsetX));
    const cy = Math.max(80, Math.min(820, baseY + offsetY));
    const type = REGION_TYPES[Math.floor(rng() * REGION_TYPES.length)];

    regions.push({
      id: `region-${seed}-${i}`,
      name: selectedNames[i],
      center_x: cx,
      center_y: cy,
      radius: randInt(40, 120),
      type,
      color: FILL_COLORS[type] || "rgba(74,144,217,0.3)",
    });
  }

  // Ensure at least 2 volcanic and 2 coastal regions for question variety
  const volcanicCount = regions.filter((r) => r.type === "volcanic").length;
  if (volcanicCount < 2) {
    for (let i = 0; i < 2 - volcanicCount && i < regions.length; i++) {
      if (regions[i].type !== "volcanic" && regions[i].type !== "coastal") {
        regions[i].type = "volcanic";
        regions[i].color = FILL_COLORS["volcanic"];
      }
    }
  }
  const coastalCount = regions.filter((r) => r.type === "coastal").length;
  if (coastalCount < 2) {
    for (
      let i = regions.length - 1;
      i >= 0 && regions.filter((r) => r.type === "coastal").length < 2;
      i--
    ) {
      if (regions[i].type !== "volcanic" && regions[i].type !== "coastal") {
        regions[i].type = "coastal";
        regions[i].color = FILL_COLORS["coastal"];
      }
    }
  }

  // Generate obstacle zones (3-4)
  const numObstacles = randInt(3, 4);
  const obstacles: ObstacleZone[] = [];
  const shuffledObstNames = [...OBSTACLE_NAMES];
  for (let i = shuffledObstNames.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledObstNames[i], shuffledObstNames[j]] = [
      shuffledObstNames[j],
      shuffledObstNames[i],
    ];
  }
  for (let i = 0; i < numObstacles; i++) {
    obstacles.push({
      id: `obstacle-${seed}-${i}`,
      name: shuffledObstNames[i],
      center_x: randInt(200, 1000),
      center_y: randInt(200, 700),
      radius: randInt(40, 80),
    });
  }

  // Generate 10-14 trade routes connecting pairs (no duplicates)
  const numRoutes = randInt(10, 14);
  const routes: TradeRoute[] = [];
  const routeSet = new Set<string>();

  // Spanning path for connectivity
  const idxOrder = Array.from({ length: NUM_REGIONS }, (_, i) => i);
  for (let i = idxOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idxOrder[i], idxOrder[j]] = [idxOrder[j], idxOrder[i]];
  }
  // Deliberately skip one edge to create an unreachable partition
  const skipEdge = randInt(2, Math.min(NUM_REGIONS - 3, idxOrder.length - 2));
  for (let i = 0; i < NUM_REGIONS - 1 && routes.length < numRoutes; i++) {
    if (i === skipEdge) continue;
    const a = idxOrder[i];
    const b = idxOrder[i + 1];
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!routeSet.has(key)) {
      routeSet.add(key);
      routes.push({
        id: `route-${seed}-${routes.length}`,
        from_region: regions[a].id,
        to_region: regions[b].id,
      });
    }
  }

  // Fill remaining slots with random edges
  let attempts = 0;
  while (routes.length < numRoutes && attempts < 200) {
    attempts++;
    const a = Math.floor(rng() * NUM_REGIONS);
    const b = Math.floor(rng() * NUM_REGIONS);
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (routeSet.has(key)) continue;
    routeSet.add(key);
    routes.push({
      id: `route-${seed}-${routes.length}`,
      from_region: regions[a].id,
      to_region: regions[b].id,
    });
  }

  const adj = buildAdjacency(regions, routes);

  // Generate SVG map
  const svg_map = generateMapSvg(regions, routes, obstacles);

  // ── Generate 10 spatial reasoning questions ──────────────────────

  const questions: SpatialQuestion[] = [];
  const answers: CartographerGroundTruth["answers"] = [];

  const qIndices = Array.from({ length: NUM_REGIONS }, (_, i) => i);
  for (let i = qIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [qIndices[i], qIndices[j]] = [qIndices[j], qIndices[i]];
  }

  // Q1: Which region is closest to [X]?
  const q1Target = regions[qIndices[0]];
  let closestRegion: OceanRegion | null = null;
  let closestDist = Infinity;
  for (const r of regions) {
    if (r.id === q1Target.id) continue;
    const d = euclideanRegion(q1Target, r);
    if (d < closestDist) {
      closestDist = d;
      closestRegion = r;
    }
  }
  questions.push({
    id: `q-${seed}-1`,
    question: `Which region is closest to ${q1Target.name}?`,
    type: "closest_region",
  });
  answers.push({
    question_id: `q-${seed}-1`,
    answer: closestRegion!.name,
    explanation: `${closestRegion!.name} is ${Math.round(closestDist)} units from ${q1Target.name}.`,
  });

  // Q2: What is the approximate distance between [A] and [B]?
  const q2A = regions[qIndices[1]];
  const q2B = regions[qIndices[2]];
  const dist = Math.round(euclideanRegion(q2A, q2B));
  questions.push({
    id: `q-${seed}-2`,
    question: `What is the approximate distance (in map units) between ${q2A.name} and ${q2B.name}?`,
    type: "distance",
  });
  answers.push({
    question_id: `q-${seed}-2`,
    answer: dist,
    explanation: `Euclidean distance between centers: ${dist}.`,
  });

  // Q3: How many trade route hops on shortest path from [A] to [B]?
  const q3A = regions[qIndices[3]];
  const q3B = regions[qIndices[4]];
  const hops = shortestPath(adj, q3A.id, q3B.id);
  questions.push({
    id: `q-${seed}-3`,
    question: `How many trade route hops are on the shortest path from ${q3A.name} to ${q3B.name}?`,
    type: "route_traversal",
  });
  answers.push({
    question_id: `q-${seed}-3`,
    answer: hops ?? -1,
    explanation:
      hops !== null
        ? `BFS shortest path traverses ${hops} trade route(s).`
        : `No trade route path exists between ${q3A.name} and ${q3B.name}.`,
  });

  // Q4: Which region has the largest area?
  let largestRegion = regions[0];
  for (const r of regions) {
    if (r.radius > largestRegion.radius) largestRegion = r;
  }
  questions.push({
    id: `q-${seed}-4`,
    question: "Which region has the largest area?",
    type: "largest_area",
  });
  answers.push({
    question_id: `q-${seed}-4`,
    answer: largestRegion.name,
    explanation: `${largestRegion.name} has the largest radius (${largestRegion.radius}).`,
  });

  // Q5: What compass direction is [A] from [B]?
  const q5A = regions[qIndices[5]];
  const q5B = regions[qIndices[6]];
  const direction = compassDirection(q5B, q5A);
  questions.push({
    id: `q-${seed}-5`,
    question: `What compass direction is ${q5A.name} from ${q5B.name}?`,
    type: "compass_direction",
  });
  answers.push({
    question_id: `q-${seed}-5`,
    answer: direction,
    explanation: `From ${q5B.name}, ${q5A.name} lies to the ${direction}.`,
  });

  // Q6: Total area of a bounding circle encompassing all volcanic regions
  const volcanicRegions = regions.filter((r) => r.type === "volcanic");
  const volcanicPoints = volcanicRegions.map((r) => ({
    x: r.center_x,
    y: r.center_y,
  }));
  const boundingR = boundingCircleRadius(volcanicPoints);
  const boundingArea = Math.round(Math.PI * boundingR * boundingR);
  questions.push({
    id: `q-${seed}-6`,
    question:
      "What is the total area (in square map units, rounded to nearest integer) of the smallest circle that encompasses all volcanic region centers?",
    type: "bounding_circle_area",
  });
  answers.push({
    question_id: `q-${seed}-6`,
    answer: boundingArea,
    explanation: `Bounding circle radius=${Math.round(boundingR)}, area=pi*r^2=${boundingArea}.`,
  });

  // Q7: Which regions are NOT reachable via trade routes from [region]?
  const q7Source = regions[qIndices[7]];
  const reachable = reachableFrom(adj, q7Source.id);
  const unreachable = regions
    .filter((r) => !reachable.has(r.id))
    .map((r) => r.name)
    .sort();
  const unreachableAnswer =
    unreachable.length > 0 ? unreachable.join(", ") : "none";
  questions.push({
    id: `q-${seed}-7`,
    question: `Which regions are NOT reachable via trade routes from ${q7Source.name}? List names alphabetically, comma-separated, or "none".`,
    type: "unreachable_regions",
  });
  answers.push({
    question_id: `q-${seed}-7`,
    answer: unreachableAnswer,
    explanation: `BFS from ${q7Source.name} reaches ${reachable.size} of ${regions.length} regions.`,
  });

  // Q8: Shortest path (distance) visiting all volcanic regions (TSP-like)
  const volcanicIds = volcanicRegions.map((r) => r.id);
  const tspDist = tspNearestNeighbor(regions, volcanicIds);
  questions.push({
    id: `q-${seed}-8`,
    question:
      "What is the total Euclidean distance of the shortest path that visits all volcanic region centers (nearest-neighbor heuristic, rounded to nearest integer)?",
    type: "tsp_volcanic",
  });
  answers.push({
    question_id: `q-${seed}-8`,
    answer: tspDist,
    explanation: `Nearest-neighbor TSP through ${volcanicIds.length} volcanic regions = ${tspDist} units.`,
  });

  // Q9: Geographic centroid of all coastal regions — which named region is nearest?
  const coastalRegions = regions.filter((r) => r.type === "coastal");
  const centroidX =
    coastalRegions.reduce((s, r) => s + r.center_x, 0) / coastalRegions.length;
  const centroidY =
    coastalRegions.reduce((s, r) => s + r.center_y, 0) / coastalRegions.length;
  let nearestToCentroid: OceanRegion = regions[0];
  let nearestCentroidDist = Infinity;
  for (const r of regions) {
    const d = euclidean(r.center_x, r.center_y, centroidX, centroidY);
    if (d < nearestCentroidDist) {
      nearestCentroidDist = d;
      nearestToCentroid = r;
    }
  }
  questions.push({
    id: `q-${seed}-9`,
    question:
      "Which region is closest to the geographic centroid of all coastal regions?",
    type: "coastal_centroid",
  });
  answers.push({
    question_id: `q-${seed}-9`,
    answer: nearestToCentroid.name,
    explanation: `Centroid of coastal regions is (${Math.round(centroidX)},${Math.round(centroidY)}). Nearest region: ${nearestToCentroid.name}.`,
  });

  // Q10: How many obstacle zones does the direct line from [A] to [B] pass through?
  const q10A = regions[qIndices[8]];
  const q10B = regions[qIndices[9]];
  let obstaclesCrossed = 0;
  for (const obs of obstacles) {
    if (
      lineIntersectsCircle(
        q10A.center_x,
        q10A.center_y,
        q10B.center_x,
        q10B.center_y,
        obs.center_x,
        obs.center_y,
        obs.radius,
      )
    ) {
      obstaclesCrossed++;
    }
  }
  questions.push({
    id: `q-${seed}-10`,
    question: `How many obstacle zones does a direct line from ${q10A.name} to ${q10B.name} pass through?`,
    type: "obstacle_count",
  });
  answers.push({
    question_id: `q-${seed}-10`,
    answer: obstaclesCrossed,
    explanation: `Direct line from ${q10A.name} to ${q10B.name} intersects ${obstaclesCrossed} obstacle zone(s).`,
  });

  const objective =
    "Analyze the procedural ocean map to answer 10 spatial reasoning questions. " +
    "Region coordinates must be parsed from SVG circle elements (cx/cy attributes). " +
    "Use trade route data, obstacle zones, and spatial analysis to determine distances, " +
    "directions, connectivity, bounding areas, and optimal paths. Submit answers keyed by question ID.";

  return {
    regions,
    routes,
    obstacles,
    svg_map,
    questions,
    groundTruth: { answers, regions },
    objective,
  };
}

/** Check if a line segment from (x1,y1)-(x2,y2) passes within radius of (cx,cy). */
function lineIntersectsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}
