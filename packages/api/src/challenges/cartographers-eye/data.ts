import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ──────────────────────────────────────────────────────

export interface OceanRegion {
  id: string;
  name: string;
  center_x: number;
  center_y: number;
  radius: number;
  type: string;
}

export interface TradeRoute {
  id: string;
  from_region: string;
  to_region: string;
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
];

const REGION_TYPES = ["shallow", "deep", "volcanic", "arctic", "tropical"];

// ── Geometry helpers ────────────────────────────────────────────────

function euclidean(a: OceanRegion, b: OceanRegion): number {
  const dx = a.center_x - b.center_x;
  const dy = a.center_y - b.center_y;
  return Math.sqrt(dx * dx + dy * dy);
}

function compassDirection(from: OceanRegion, to: OceanRegion): string {
  const dx = to.center_x - from.center_x;
  const dy = from.center_y - to.center_y; // SVG y-axis is inverted
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI; // 0=N, 90=E
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

/** BFS shortest path on the trade-route graph (returns hop count). */
function shortestPath(
  regions: OceanRegion[],
  routes: TradeRoute[],
  startId: string,
  endId: string,
): number | null {
  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const r of regions) adj.set(r.id, []);
  for (const route of routes) {
    adj.get(route.from_region)!.push(route.to_region);
    adj.get(route.to_region)!.push(route.from_region);
  }

  const visited = new Set<string>();
  const queue: Array<{ id: string; hops: number }> = [{ id: startId, hops: 0 }];
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
  return null; // no path
}

// ── SVG generation ──────────────────────────────────────────────────

function generateMapSvg(regions: OceanRegion[], routes: TradeRoute[]): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800">`;
  svg += `<rect width="1000" height="800" fill="#1a2744"/>`;

  // Draw routes as dashed lines
  for (const route of routes) {
    const from = regions.find((r) => r.id === route.from_region)!;
    const to = regions.find((r) => r.id === route.to_region)!;
    svg += `<line x1="${from.center_x}" y1="${from.center_y}" x2="${to.center_x}" y2="${to.center_y}" stroke="#4A90D9" stroke-width="2" stroke-dasharray="5,5"/>`;
  }

  // Draw regions as circles with labels
  for (const r of regions) {
    const fillColors: Record<string, string> = {
      shallow: "rgba(74,217,144,0.3)",
      deep: "rgba(74,90,217,0.3)",
      volcanic: "rgba(217,74,74,0.3)",
      arctic: "rgba(180,220,255,0.3)",
      tropical: "rgba(217,180,74,0.3)",
    };
    const fill = fillColors[r.type] || "rgba(74,144,217,0.3)";
    svg += `<circle cx="${r.center_x}" cy="${r.center_y}" r="${r.radius}" fill="${fill}" stroke="#4A90D9"/>`;
    svg += `<text x="${r.center_x}" y="${r.center_y}" text-anchor="middle" fill="white" font-size="12">${r.name}</text>`;
  }

  // Compass rose
  svg += `<g transform="translate(950,50)">`;
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
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  // Shuffle region names and pick 10
  const shuffledNames = [...REGION_NAMES];
  for (let i = shuffledNames.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledNames[i], shuffledNames[j]] = [shuffledNames[j], shuffledNames[i]];
  }
  const selectedNames = shuffledNames.slice(0, 10);

  // Generate regions spread across the 1000x800 canvas
  // Use a grid-based approach to ensure spread: 5 columns x 2 rows
  const regions: OceanRegion[] = [];
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    // Base position from grid cell, then add randomized offset
    const baseX = 100 + col * 180;
    const baseY = 200 + row * 300;
    const offsetX = randInt(-60, 60);
    const offsetY = randInt(-80, 80);
    const cx = Math.max(80, Math.min(920, baseX + offsetX));
    const cy = Math.max(80, Math.min(720, baseY + offsetY));

    regions.push({
      id: `region-${seed}-${i}`,
      name: selectedNames[i],
      center_x: cx,
      center_y: cy,
      radius: randInt(50, 150),
      type: REGION_TYPES[Math.floor(rng() * REGION_TYPES.length)],
    });
  }

  // Generate 6-8 trade routes connecting pairs (no duplicates)
  const numRoutes = randInt(6, 8);
  const routes: TradeRoute[] = [];
  const routeSet = new Set<string>();

  // First, ensure connectivity: create a spanning path through shuffled indices
  const idxOrder = Array.from({ length: 10 }, (_, i) => i);
  for (let i = idxOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idxOrder[i], idxOrder[j]] = [idxOrder[j], idxOrder[i]];
  }
  // Connect consecutive pairs in the shuffled order (9 edges for spanning path)
  // but we only need numRoutes total, so take min(numRoutes-1, 9) from spanning path
  const spanEdges = Math.min(numRoutes - 1, 9);
  for (let i = 0; i < spanEdges && routes.length < numRoutes; i++) {
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
  while (routes.length < numRoutes && attempts < 100) {
    attempts++;
    const a = Math.floor(rng() * 10);
    const b = Math.floor(rng() * 10);
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

  // Generate SVG map
  const svg_map = generateMapSvg(regions, routes);

  // ── Generate 5 spatial reasoning questions ──────────────────────

  const questions: SpatialQuestion[] = [];
  const answers: CartographerGroundTruth["answers"] = [];

  // Shuffle indices for picking question subjects
  const qIndices = Array.from({ length: 10 }, (_, i) => i);
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
    const d = euclidean(q1Target, r);
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
    explanation: `${closestRegion!.name} is ${Math.round(closestDist)} units from ${q1Target.name}, the shortest Euclidean distance of any region.`,
  });

  // Q2: What is the approximate distance between [A] and [B]?
  const q2A = regions[qIndices[1]];
  const q2B = regions[qIndices[2]];
  const dist = Math.round(euclidean(q2A, q2B));
  questions.push({
    id: `q-${seed}-2`,
    question: `What is the approximate distance (in map units) between ${q2A.name} and ${q2B.name}?`,
    type: "distance",
  });
  answers.push({
    question_id: `q-${seed}-2`,
    answer: dist,
    explanation: `Euclidean distance between centers: sqrt((${q2A.center_x}-${q2B.center_x})^2 + (${q2A.center_y}-${q2B.center_y})^2) = ${dist}.`,
  });

  // Q3: How many regions must you traverse on the shortest trade route from [A] to [B]?
  // Pick two regions that are likely connected but not adjacent
  const q3A = regions[qIndices[3]];
  const q3B = regions[qIndices[4]];
  const hops = shortestPath(regions, routes, q3A.id, q3B.id);
  questions.push({
    id: `q-${seed}-3`,
    question: `How many trade route hops are on the shortest path from ${q3A.name} to ${q3B.name}?`,
    type: "route_traversal",
  });
  answers.push({
    question_id: `q-${seed}-3`,
    answer: hops ?? -1,
    explanation: hops !== null
      ? `BFS shortest path from ${q3A.name} to ${q3B.name} traverses ${hops} trade route(s).`
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
    explanation: `${largestRegion.name} has the largest radius (${largestRegion.radius}), so it covers the most area.`,
  });

  // Q5: What compass direction is [A] from [B]?
  const q5A = regions[qIndices[5]];
  const q5B = regions[qIndices[6]];
  const direction = compassDirection(q5B, q5A); // direction of A as seen from B
  questions.push({
    id: `q-${seed}-5`,
    question: `What compass direction is ${q5A.name} from ${q5B.name}?`,
    type: "compass_direction",
  });
  answers.push({
    question_id: `q-${seed}-5`,
    answer: direction,
    explanation: `From ${q5B.name} (${q5B.center_x},${q5B.center_y}), ${q5A.name} (${q5A.center_x},${q5A.center_y}) lies to the ${direction}.`,
  });

  const objective =
    "Analyze the procedural ocean map to answer 5 spatial reasoning questions. " +
    "Use the map SVG, region legend, and trade route data to determine distances, " +
    "directions, areas, and shortest paths. Submit answers keyed by question ID.";

  return {
    regions,
    routes,
    svg_map,
    questions,
    groundTruth: { answers, regions },
    objective,
  };
}
