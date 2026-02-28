import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ───────────────────────────────────────────────────────

export interface Blueprint {
  id: string;
  name: string;
  floor: number;
  ascii: string;
  legend: Record<string, string>;
}

export interface BuildingRule {
  id: string;
  rule_number: number;
  category: string;
  text: string;
}

export interface Violation {
  id: string;
  blueprint_id: string;
  rule_id: string;
  violation_type: string;
  location: string;
  description: string;
}

export interface BlueprintGroundTruth {
  violations: Violation[];
  compliant_blueprints: string[];
}

export interface BlueprintData {
  blueprints: Blueprint[];
  rules: BuildingRule[];
  specifications: Record<string, number>;
  groundTruth: BlueprintGroundTruth;
  objective: string;
}

// ── Building rules ───────────────────────────────────────────────────

const RULES: Omit<BuildingRule, "id">[] = [
  { rule_number: 1, category: "egress", text: "Every habitable room (A-Z, excluding B and S) must have at least 1 window (W)." },
  { rule_number: 2, category: "egress", text: "Stairways (marked S) must be at least 3 characters wide." },
  { rule_number: 3, category: "egress", text: "Emergency exits (doors D on exterior walls) required every 10 horizontal units." },
  { rule_number: 4, category: "circulation", text: "Corridors (unmarked interior space) must be at least 2 characters wide." },
  { rule_number: 5, category: "egress", text: "Every floor must have at least 2 stairways." },
  { rule_number: 6, category: "capacity", text: "No room shall exceed 50 square units of interior space without having 2 doors (D)." },
  { rule_number: 7, category: "ventilation", text: "Windows (W) required on all exterior-facing walls of habitable rooms." },
  { rule_number: 8, category: "fire_safety", text: "Fire doors (F) must separate corridor sections longer than 15 units." },
  { rule_number: 9, category: "privacy", text: "Bathrooms (rooms marked B) must not have windows (W) to the exterior." },
  { rule_number: 10, category: "exemption", text: "Storage rooms (rooms marked S) need not have windows." },
  { rule_number: 11, category: "ventilation", text: "Maximum room depth (distance from nearest window to farthest interior wall) shall not exceed 8 units." },
  { rule_number: 12, category: "egress", text: "All rooms must be reachable from at least one corridor via a door (D)." },
];

// ── Legend shared by all blueprints ──────────────────────────────────

const LEGEND: Record<string, string> = {
  "#": "Wall",
  "D": "Door",
  "W": "Window",
  "S": "Stairway",
  "F": "Fire door",
  " ": "Corridor / open space",
  "A-Z": "Room label (repeating character fills the room interior)",
};

// ── Floor plan templates ─────────────────────────────────────────────
// Each template is a function that returns an ASCII grid (array of char arrays)
// and a list of room metadata. Templates can be mutated to introduce violations.

interface RoomMeta {
  label: string;
  floor: number;
  topRow: number;
  leftCol: number;
  bottomRow: number;
  rightCol: number;
}

/**
 * Create a blank 20x30 grid filled with spaces.
 */
function blankGrid(): string[][] {
  const rows: string[][] = [];
  for (let r = 0; r < 20; r++) {
    rows.push(new Array(30).fill(" "));
  }
  return rows;
}

/**
 * Draw a rectangular room on the grid with walls, label fill, doors, and windows.
 */
function drawRoom(
  grid: string[][],
  top: number, left: number, bottom: number, right: number,
  label: string,
  doors: [number, number][],
  windows: [number, number][],
) {
  // Walls
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (r === top || r === bottom || c === left || c === right) {
        grid[r][c] = "#";
      } else {
        grid[r][c] = label;
      }
    }
  }
  // Doors
  for (const [r, c] of doors) {
    grid[r][c] = "D";
  }
  // Windows
  for (const [r, c] of windows) {
    grid[r][c] = "W";
  }
}

/**
 * Draw a stairway block on the grid.
 */
function drawStairway(
  grid: string[][],
  top: number, left: number, bottom: number, right: number,
) {
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (r === top || r === bottom || c === left || c === right) {
        grid[r][c] = "#";
      } else {
        grid[r][c] = "S";
      }
    }
  }
}

function gridToString(grid: string[][]): string {
  return grid.map((row) => row.join("")).join("\n");
}

// ── Violation planting helpers ───────────────────────────────────────

interface ViolationSeed {
  type: string;
  ruleNumber: number;
  apply: (grid: string[][], rooms: RoomMeta[]) => { location: string; description: string } | null;
}

// ── Main generator ──────────────────────────────────────────────────

export function generateBlueprintData(seed: number): BlueprintData {
  const rng = mulberry32(seed);
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const rules: BuildingRule[] = RULES.map((r, i) => ({
    ...r,
    id: `rule-${i + 1}`,
  }));

  const violations: Violation[] = [];
  let violationId = 0;

  // ── Blueprint 1: Ground Floor ──────────────────────────────────────
  const grid1 = blankGrid();
  const rooms1: RoomMeta[] = [];

  // Exterior walls
  for (let r = 0; r < 20; r++) {
    grid1[r][0] = "#";
    grid1[r][29] = "#";
  }
  for (let c = 0; c < 30; c++) {
    grid1[0][c] = "#";
    grid1[19][c] = "#";
  }

  // Room A: large office (top-left), 6x8 interior
  drawRoom(grid1, 1, 1, 8, 10, "A", [[8, 5]], [[1, 4], [1, 7]]);
  rooms1.push({ label: "A", floor: 1, topRow: 1, leftCol: 1, bottomRow: 8, rightCol: 10 });

  // Room C: medium room (top-right)
  drawRoom(grid1, 1, 16, 7, 28, "C", [[7, 22]], [[1, 20], [1, 24]]);
  rooms1.push({ label: "C", floor: 1, topRow: 1, leftCol: 16, bottomRow: 7, rightCol: 28 });

  // Room E: conference room (bottom-left), large — intentionally > 50 sq units with only 1 door (violation rule 6)
  drawRoom(grid1, 11, 1, 18, 14, "E", [[11, 7]], [[18, 4], [18, 10]]);
  rooms1.push({ label: "E", floor: 1, topRow: 11, leftCol: 1, bottomRow: 18, rightCol: 14 });
  // Interior: 7 rows x 13 cols = 91 sq units > 50 — only 1 door = violation

  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-1",
    rule_id: "rule-6",
    violation_type: "large_room_insufficient_doors",
    location: "Room E, Floor 1",
    description: "Room E has 91 sq units of interior space but only 1 door. Rule 6 requires 2 doors for rooms exceeding 50 sq units.",
  });

  // Room G: small office (bottom-right) — NO window (violation rule 1)
  drawRoom(grid1, 12, 20, 18, 28, "G", [[12, 24]], []);
  rooms1.push({ label: "G", floor: 1, topRow: 12, leftCol: 20, bottomRow: 18, rightCol: 28 });

  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-1",
    rule_id: "rule-1",
    violation_type: "missing_window",
    location: "Room G, Floor 1",
    description: "Room G is a habitable room with no windows. Rule 1 requires at least 1 window in every habitable room.",
  });

  // Stairway 1 (only stairway on this floor — violation rule 5: need at least 2)
  drawStairway(grid1, 9, 12, 11, 14);

  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-1",
    rule_id: "rule-5",
    violation_type: "insufficient_stairways",
    location: "Floor 1",
    description: "Floor 1 has only 1 stairway. Rule 5 requires every floor to have at least 2 stairways.",
  });

  // Emergency exit doors on exterior
  grid1[19][7] = "D";
  // No exit in the right half — violation rule 3 (need exit every 10 horiz units)
  // Exterior spans 0-29 (30 units). One exit at col 7 — gap from 7 to 29 is 22 units > 10.
  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-1",
    rule_id: "rule-3",
    violation_type: "missing_emergency_exit",
    location: "Exterior south wall, Floor 1, columns 10-29",
    description: "No emergency exit on the south exterior wall between columns 10 and 29. Rule 3 requires exits every 10 horizontal units.",
  });

  const bp1Ascii = gridToString(grid1);

  // ── Blueprint 2: Second Floor ──────────────────────────────────────
  const grid2 = blankGrid();
  const rooms2: RoomMeta[] = [];

  // Exterior walls
  for (let r = 0; r < 20; r++) {
    grid2[r][0] = "#";
    grid2[r][29] = "#";
  }
  for (let c = 0; c < 30; c++) {
    grid2[0][c] = "#";
    grid2[19][c] = "#";
  }

  // Room H: top-left office with windows
  drawRoom(grid2, 1, 1, 7, 10, "H", [[7, 5]], [[0, 4], [0, 7]]);
  rooms2.push({ label: "H", floor: 2, topRow: 1, leftCol: 1, bottomRow: 7, rightCol: 10 });

  // Room J: top-right lab
  drawRoom(grid2, 1, 16, 7, 28, "J", [[7, 22]], [[0, 20], [0, 24]]);
  rooms2.push({ label: "J", floor: 2, topRow: 1, leftCol: 16, bottomRow: 7, rightCol: 28 });

  // Room K: deep room (bottom-left) — depth exceeds 8 units (violation rule 11)
  // 10 rows tall, window only on bottom wall
  drawRoom(grid2, 8, 1, 18, 10, "K", [[8, 5]], [[18, 4]]);
  rooms2.push({ label: "K", floor: 2, topRow: 8, leftCol: 1, bottomRow: 18, rightCol: 10 });
  // Interior height: rows 9-17 = 9 rows. Window at row 18. Farthest interior wall at row 9 = 9 units from window > 8.

  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-2",
    rule_id: "rule-11",
    violation_type: "excessive_room_depth",
    location: "Room K, Floor 2",
    description: "Room K has a depth of 9 units from the nearest window to the farthest interior wall. Rule 11 limits maximum depth to 8 units.",
  });

  // Bathroom B: has exterior window (violation rule 9)
  drawRoom(grid2, 10, 20, 14, 28, "B", [[10, 24]], [[14, 29]]);
  rooms2.push({ label: "B", floor: 2, topRow: 10, leftCol: 20, bottomRow: 14, rightCol: 28 });

  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-2",
    rule_id: "rule-9",
    violation_type: "bathroom_exterior_window",
    location: "Room B (bathroom), Floor 2",
    description: "Room B is a bathroom with a window on the exterior wall at column 29. Rule 9 prohibits bathrooms from having exterior windows.",
  });

  // Stairway 1 — only 2 chars wide (violation rule 2: must be 3 wide)
  // Interior width = right - left - 1 = 2 chars
  drawStairway(grid2, 15, 13, 18, 16);
  // Interior width: cols 14-15 = 2 chars. Rule requires 3.

  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-2",
    rule_id: "rule-2",
    violation_type: "narrow_stairway",
    location: "Stairway at columns 13-16, Floor 2",
    description: "Stairway interior is only 2 characters wide. Rule 2 requires stairways to be at least 3 characters wide.",
  });

  // Stairway 2 — compliant (3 chars wide interior)
  drawStairway(grid2, 15, 22, 18, 26);

  // Emergency exits
  grid2[19][7] = "D";
  grid2[19][22] = "D";

  const bp2Ascii = gridToString(grid2);

  // ── Blueprint 3: Third Floor ───────────────────────────────────────
  const grid3 = blankGrid();
  const rooms3: RoomMeta[] = [];

  // Exterior walls
  for (let r = 0; r < 20; r++) {
    grid3[r][0] = "#";
    grid3[r][29] = "#";
  }
  for (let c = 0; c < 30; c++) {
    grid3[0][c] = "#";
    grid3[19][c] = "#";
  }

  // Room M: top-left with windows
  drawRoom(grid3, 1, 1, 6, 10, "M", [[6, 5]], [[0, 4], [0, 7]]);
  rooms3.push({ label: "M", floor: 3, topRow: 1, leftCol: 1, bottomRow: 6, rightCol: 10 });

  // Room N: top-right with windows
  drawRoom(grid3, 1, 16, 6, 28, "N", [[6, 22]], [[0, 20], [0, 24]]);
  rooms3.push({ label: "N", floor: 3, topRow: 1, leftCol: 16, bottomRow: 6, rightCol: 28 });

  // Room P: mid-left, corridor to it is only 1 char wide (violation rule 4)
  // We draw the corridor explicitly narrow
  drawRoom(grid3, 9, 1, 14, 10, "P", [[9, 5]], [[9, 0]]);
  rooms3.push({ label: "P", floor: 3, topRow: 9, leftCol: 1, bottomRow: 14, rightCol: 10 });

  // Narrow corridor: fill row 8, cols 1-10 as wall leaving only 1-char gap
  for (let c = 1; c <= 10; c++) {
    grid3[7][c] = "#";
  }
  // Row 8 is corridor — only 1 row between wall at row 7 and room wall at row 9
  // That is 1 char wide corridor

  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-3",
    rule_id: "rule-4",
    violation_type: "narrow_corridor",
    location: "Corridor between rows 7-9, columns 1-10, Floor 3",
    description: "Corridor leading to Room P is only 1 character wide. Rule 4 requires corridors to be at least 2 characters wide.",
  });

  // Room Q: bottom-right
  drawRoom(grid3, 10, 18, 18, 28, "Q", [[10, 23]], [[18, 22], [18, 25]]);
  rooms3.push({ label: "Q", floor: 3, topRow: 10, leftCol: 18, bottomRow: 18, rightCol: 28 });

  // Storage room (S label) — compliant, no window needed per rule 10
  drawRoom(grid3, 15, 1, 18, 8, "S", [[15, 4]], []);
  rooms3.push({ label: "S", floor: 3, topRow: 15, leftCol: 1, bottomRow: 18, rightCol: 8 });

  // Two compliant stairways
  drawStairway(grid3, 10, 12, 14, 16);
  drawStairway(grid3, 15, 12, 18, 16);

  // Emergency exits
  grid3[19][7] = "D";
  grid3[19][22] = "D";

  const bp3Ascii = gridToString(grid3);

  // ── Blueprint 4: Fourth Floor (L-shaped rooms, fire doors, unreachable room) ─

  const grid4 = blankGrid();
  const rooms4: RoomMeta[] = [];

  // Exterior walls
  for (let r = 0; r < 20; r++) {
    grid4[r][0] = "#";
    grid4[r][29] = "#";
  }
  for (let c = 0; c < 30; c++) {
    grid4[0][c] = "#";
    grid4[19][c] = "#";
  }

  // Room R: L-shaped room (top-left). Two rectangles merged with shared wall removed.
  // Top part: rows 1-6, cols 1-14. Bottom part: rows 7-10, cols 1-8.
  drawRoom(grid4, 1, 1, 6, 14, "R", [[6, 10]], [[0, 5], [0, 9]]);
  drawRoom(grid4, 7, 1, 10, 8, "R", [], []);
  // Remove the shared wall between the two parts
  for (let c = 2; c <= 7; c++) {
    grid4[6][c] = "R"; // was wall #, now interior
  }
  grid4[7][1] = "#"; // keep outer wall
  grid4[7][8] = "#"; // keep outer wall
  rooms4.push({ label: "R", floor: 4, topRow: 1, leftCol: 1, bottomRow: 10, rightCol: 14 });

  // Room R has windows on top exterior wall only (cols 5 and 9).
  // The L-shape extends down to row 10. Farthest interior from window is row 9 (9 units from row 0 window).
  // This is a rule 11 violation (depth > 8) but tricky because it's L-shaped.
  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-4",
    rule_id: "rule-11",
    violation_type: "excessive_room_depth",
    location: "Room R (L-shaped), Floor 4",
    description: "Room R is L-shaped. The bottom portion extends to row 10, giving a depth of 9 units from the nearest windows at row 0. Rule 11 limits depth to 8 units.",
  });

  // Room T: top-right, habitable room on exterior wall but NO windows on the right exterior wall
  // (violation rule 7: windows required on ALL exterior-facing walls of habitable rooms)
  drawRoom(grid4, 1, 18, 8, 28, "T", [[8, 23]], [[0, 22], [0, 25]]);
  rooms4.push({ label: "T", floor: 4, topRow: 1, leftCol: 18, bottomRow: 8, rightCol: 28 });
  // Room T has windows on top wall (exterior) but none on right wall (col 28, also exterior).
  // The right wall at col 28 IS adjacent to col 29 (the building exterior). No W on that wall.
  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-4",
    rule_id: "rule-7",
    violation_type: "missing_exterior_window",
    location: "Room T, Floor 4, right exterior wall",
    description: "Room T has an exterior-facing right wall (column 28, adjacent to building exterior at column 29) with no windows. Rule 7 requires windows on all exterior-facing walls of habitable rooms.",
  });

  // Long corridor without fire doors: row 11, cols 1-28 (27 units > 15, violation rule 8)
  for (let c = 1; c <= 28; c++) {
    grid4[10][c] = "#"; // wall above corridor
    grid4[12][c] = "#"; // wall below corridor
  }
  // Row 11 is the corridor (1 char high, but 2 chars wide counting row 11 passage)
  // Actually make it 2 chars wide: rows 11-12 are corridor, row 13 is wall
  for (let c = 1; c <= 28; c++) {
    grid4[10][c] = "#"; // wall
    grid4[11][c] = " "; // corridor
    grid4[13][c] = "#"; // wall below
    grid4[12][c] = " "; // corridor
  }
  // The corridor spans cols 1-28 = 28 units with no fire door. Rule 8 requires F every 15 units.
  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-4",
    rule_id: "rule-8",
    violation_type: "missing_fire_door",
    location: "Corridor at rows 11-12, Floor 4",
    description: "Corridor section spans 28 units (columns 1-28) without any fire doors. Rule 8 requires fire doors separating corridor sections longer than 15 units.",
  });

  // Room U: enclosed room with NO door (violation rule 12: all rooms reachable from corridor via door)
  drawRoom(grid4, 14, 1, 18, 8, "U", [], [[18, 4]]);
  rooms4.push({ label: "U", floor: 4, topRow: 14, leftCol: 1, bottomRow: 18, rightCol: 8 });
  violations.push({
    id: `v-${++violationId}`,
    blueprint_id: "bp-4",
    rule_id: "rule-12",
    violation_type: "unreachable_room",
    location: "Room U, Floor 4",
    description: "Room U has no doors and is not reachable from any corridor. Rule 12 requires all rooms to be reachable from at least one corridor via a door.",
  });

  // Room V: compliant mid-right
  drawRoom(grid4, 14, 16, 18, 28, "V", [[14, 22]], [[18, 20], [18, 25]]);
  rooms4.push({ label: "V", floor: 4, topRow: 14, leftCol: 16, bottomRow: 18, rightCol: 28 });

  // Two compliant stairways
  drawStairway(grid4, 14, 10, 18, 14);
  drawStairway(grid4, 1, 15, 4, 17);

  // Emergency exits
  grid4[19][7] = "D";
  grid4[19][22] = "D";

  const bp4Ascii = gridToString(grid4);

  // ── Shuffle violation order based on seed ──────────────────────────
  const shuffledViolations = shuffle(violations);
  shuffledViolations.forEach((v, i) => {
    v.id = `v-${i + 1}`;
  });

  // ── Determine compliant blueprints ────────────────────────────────
  const blueprintIds = ["bp-1", "bp-2", "bp-3", "bp-4"];
  const violatedBpIds = new Set(shuffledViolations.map((v) => v.blueprint_id));
  const compliantBps = blueprintIds.filter((id) => !violatedBpIds.has(id));

  // ── Build blueprint names from seed ────────────────────────────────
  const buildingNames = [
    "Coral Heights", "Reef Tower", "Tide Centre", "Claw Pavilion",
    "Deep Spire", "Shell Plaza", "Anchor Hall", "Kelp Manor",
  ];
  const namePool = shuffle(buildingNames);

  const blueprints: Blueprint[] = [
    { id: "bp-1", name: `${namePool[0]} — Ground Floor`, floor: 1, ascii: bp1Ascii, legend: LEGEND },
    { id: "bp-2", name: `${namePool[1]} — Second Floor`, floor: 2, ascii: bp2Ascii, legend: LEGEND },
    { id: "bp-3", name: `${namePool[2]} — Third Floor`, floor: 3, ascii: bp3Ascii, legend: LEGEND },
    { id: "bp-4", name: `${namePool[3]} — Fourth Floor`, floor: 4, ascii: bp4Ascii, legend: LEGEND },
  ];

  const specifications: Record<string, number> = {
    min_corridor_width: 2,
    min_stairway_width: 3,
    max_emergency_exit_spacing: 10,
    min_stairways_per_floor: 2,
    max_room_area_single_door: 50,
    max_room_depth: 8,
  };

  const objective =
    "Audit 4 architectural blueprints against the building code (12 rules). " +
    "Floor plans include standard rectangular rooms and L-shaped rooms requiring careful spatial reasoning. " +
    "Identify all code violations, specifying the blueprint, rule violated, location, and description for each. " +
    "Be thorough: every rule in the code may or may not be violated. Submit your findings as a list of violations.";

  return {
    blueprints,
    rules,
    specifications,
    groundTruth: {
      violations: shuffledViolations,
      compliant_blueprints: compliantBps,
    },
    objective,
  };
}
