import { mulberry32 } from "../../services/whimsy.js";

export interface LogicPuzzle {
  id: string;
  type: "propositional" | "constraint";
  difficulty: number;
  premises: string[];
  rules: string[];
  question: string;
}

export interface LogicGroundTruth {
  puzzles: Array<{
    id: string;
    answer: string | boolean | number;
    reasoning: string;
    minimal_steps: number;
  }>;
}

export interface LogicData {
  puzzles: LogicPuzzle[];
  groundTruth: LogicGroundTruth;
  objective: string;
}

const ENTITIES = [
  "crab", "octopus", "shark", "eel", "starfish", "seahorse",
  "jellyfish", "turtle", "dolphin", "ray", "lobster", "nautilus",
];
const COLORS = ["red", "blue", "green", "gold", "silver", "purple", "coral", "teal", "amber", "ivory"];
const ZONES = [
  "north reef", "south reef", "deep trench", "coral garden",
  "tidal pool", "kelp forest", "lava vent", "sand flat",
  "twilight zone", "barrier ridge",
];
const ROLES = ["scout", "guard", "healer", "builder", "elder", "hunter", "navigator", "artisan"];

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Generate a hard CSP puzzle: assign attributes to N entities under constraints
function generateHardCSP(
  seed: number, rng: () => number, idx: number
): { puzzle: LogicPuzzle; truth: LogicGroundTruth["puzzles"][0] } {
  const n = 5 + Math.floor(rng() * 3); // 5-7 entities
  const entities = shuffle(ENTITIES, rng).slice(0, n);
  const colors = shuffle(COLORS, rng).slice(0, n);
  const zones = shuffle(ZONES, rng).slice(0, n);

  // Create the ground truth assignment
  const colorAssign: Record<string, string> = {};
  const zoneAssign: Record<string, string> = {};
  for (let i = 0; i < n; i++) {
    colorAssign[entities[i]] = colors[i];
    zoneAssign[entities[i]] = zones[i];
  }

  const premises: string[] = [];

  // Direct clues (give 2-3)
  const directCount = 2 + Math.floor(rng() * 2);
  const directIndices = shuffle(Array.from({ length: n }, (_, i) => i), rng).slice(0, directCount);
  for (const di of directIndices) {
    if (rng() > 0.5) {
      premises.push(`The ${entities[di]} is ${colorAssign[entities[di]]}.`);
    } else {
      premises.push(`The ${entities[di]} lives in the ${zoneAssign[entities[di]]}.`);
    }
  }

  // Negative clues (4-6): entity is NOT a color/zone
  for (let i = 0; i < n; i++) {
    if (directIndices.includes(i)) continue;
    const wrongColor = colors[(i + 2) % n];
    premises.push(`The ${entities[i]} is NOT ${wrongColor}.`);
    if (rng() > 0.4) {
      const wrongZone = zones[(i + 3) % n];
      premises.push(`The ${entities[i]} does NOT live in the ${wrongZone}.`);
    }
  }

  // Relational clues (2-3)
  for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) {
    const i = Math.floor(rng() * n);
    const j = (i + 1 + Math.floor(rng() * (n - 1))) % n;
    if (rng() > 0.5) {
      premises.push(`The creature in the ${zoneAssign[entities[i]]} is ${colorAssign[entities[i]]}.`);
    } else {
      premises.push(`The ${colorAssign[entities[j]]} creature lives in the ${zoneAssign[entities[j]]}.`);
    }
  }

  // Conditional clues (1-2)
  const ci = Math.floor(rng() * n);
  const cj = (ci + 1) % n;
  premises.push(
    `If any creature is ${colorAssign[entities[ci]]}, then it lives in the ${zoneAssign[entities[ci]]}.`
  );
  if (rng() > 0.5) {
    premises.push(
      `If any creature lives in the ${zoneAssign[entities[cj]]}, then it is NOT ${colors[(cj + 2) % n]}.`
    );
  }

  // Distractor premises (true but unhelpful)
  premises.push(`There are exactly ${n} creatures in the reef.`);
  if (rng() > 0.5) {
    premises.push(`At least one creature is either ${colors[0]} or ${colors[1]}.`);
  }

  const rules = [
    `Each creature has exactly one color and one zone.`,
    `All ${n} colors are used exactly once: ${colors.join(", ")}.`,
    `All ${n} zones are used exactly once: ${zones.join(", ")}.`,
  ];

  // Pick a target that's NOT directly given
  const nonDirect = Array.from({ length: n }, (_, i) => i).filter(i => !directIndices.includes(i));
  const targetIdx = nonDirect[Math.floor(rng() * nonDirect.length)] ?? 0;
  const askColor = rng() > 0.5;
  const question = askColor
    ? `What color is the ${entities[targetIdx]}?`
    : `Where does the ${entities[targetIdx]} live?`;
  const answer = askColor ? colorAssign[entities[targetIdx]] : zoneAssign[entities[targetIdx]];

  const assignStr = entities.map(e => `${e}: ${colorAssign[e]}, ${zoneAssign[e]}`).join("; ");

  return {
    puzzle: {
      id: `logic-${seed}-csp-${idx}`,
      type: "constraint",
      difficulty: n,
      premises: shuffle(premises, rng),
      rules,
      question,
    },
    truth: {
      id: `logic-${seed}-csp-${idx}`,
      answer,
      reasoning: `Full assignment: ${assignStr}`,
      minimal_steps: n - directCount,
    },
  };
}

// Generate a multi-step propositional logic puzzle
function generateHardPropositional(
  seed: number, rng: () => number, idx: number
): { puzzle: LogicPuzzle; truth: LogicGroundTruth["puzzles"][0] } {
  const entities = shuffle(ENTITIES, rng).slice(0, 6);
  const locs = shuffle(ZONES, rng).slice(0, 6);
  const roles = shuffle(ROLES, rng).slice(0, 4);

  const variant = Math.floor(rng() * 4);

  let premises: string[];
  let rules: string[];
  let question: string;
  let answer: string | boolean;
  let reasoning: string;
  let minSteps: number;

  if (variant === 0) {
    // 5-step chain with a branch and negation
    premises = [
      `The ${entities[0]} is a ${roles[0]}.`,
      `If any creature is a ${roles[0]}, it lives in the ${locs[0]}.`,
      `If any creature lives in the ${locs[0]}, it is allied with the ${entities[1]}.`,
      `If any creature is allied with the ${entities[1]}, the ${entities[2]} moves to the ${locs[2]}.`,
      `If the ${entities[2]} is in the ${locs[2]}, then the ${entities[3]} is NOT in the ${locs[3]}.`,
      `If the ${entities[3]} is NOT in the ${locs[3]}, the ${entities[3]} is in the ${locs[4]}.`,
      `The ${entities[4]} is a ${roles[1]}.`, // distractor
    ];
    rules = ["Apply the chain of implications step by step. Some premises are distractors."];
    question = `Where is the ${entities[3]}?`;
    answer = locs[4];
    reasoning = `${entities[0]} is ${roles[0]} -> lives in ${locs[0]} -> allied with ${entities[1]} -> ${entities[2]} moves to ${locs[2]} -> ${entities[3]} NOT in ${locs[3]} -> ${entities[3]} in ${locs[4]}`;
    minSteps = 5;
  } else if (variant === 1) {
    // Disjunction elimination
    premises = [
      `Either the ${entities[0]} is in the ${locs[0]} or the ${entities[1]} is in the ${locs[1]}.`,
      `If the ${entities[0]} is in the ${locs[0]}, then the ${entities[2]} is a ${roles[0]}.`,
      `If the ${entities[1]} is in the ${locs[1]}, then the ${entities[2]} is a ${roles[0]}.`,
      `The ${entities[0]} is NOT in the ${locs[0]}.`,
      `If the ${entities[2]} is a ${roles[0]}, then the ${entities[3]} is in the ${locs[3]}.`,
      `If the ${entities[3]} is in the ${locs[3]}, then the ${entities[4]} is NOT a ${roles[1]}.`,
      `The ${entities[5]} is a ${roles[2]}.`, // distractor
    ];
    rules = ["Use disjunction elimination and chaining to derive the answer."];
    question = `Is the ${entities[4]} a ${roles[1]}?`;
    answer = false;
    reasoning = `${entities[0]} NOT in ${locs[0]}, so by disjunction ${entities[1]} in ${locs[1]} -> ${entities[2]} is ${roles[0]} -> ${entities[3]} in ${locs[3]} -> ${entities[4]} NOT ${roles[1]}`;
    minSteps = 4;
  } else if (variant === 2) {
    // Double negation + contrapositive
    premises = [
      `If the ${entities[0]} is in the ${locs[0]}, then the ${entities[1]} is in the ${locs[1]}.`,
      `If the ${entities[1]} is in the ${locs[1]}, then the ${entities[2]} is a ${roles[0]}.`,
      `The ${entities[2]} is NOT a ${roles[0]}.`,
      `If the ${entities[0]} is NOT in the ${locs[0]}, then the ${entities[3]} is in the ${locs[2]}.`,
      `If the ${entities[3]} is in the ${locs[2]}, then the ${entities[4]} is in the ${locs[3]}.`,
      `It is false that the ${entities[5]} is a ${roles[1]}.`, // distractor
    ];
    rules = ["Use contrapositive reasoning and forward chaining."];
    question = `Where is the ${entities[4]}?`;
    answer = locs[3];
    reasoning = `${entities[2]} NOT ${roles[0]} -> (contrapositive) ${entities[1]} NOT in ${locs[1]} -> ${entities[0]} NOT in ${locs[0]} -> ${entities[3]} in ${locs[2]} -> ${entities[4]} in ${locs[3]}`;
    minSteps = 4;
  } else {
    // Biconditional + elimination
    premises = [
      `The ${entities[0]} is in the ${locs[0]} if and only if the ${entities[1]} is a ${roles[0]}.`,
      `The ${entities[1]} is a ${roles[0]}.`,
      `If the ${entities[0]} is in the ${locs[0]}, then either the ${entities[2]} is in the ${locs[1]} or the ${entities[3]} is in the ${locs[2]}.`,
      `The ${entities[2]} is NOT in the ${locs[1]}.`,
      `If the ${entities[3]} is in the ${locs[2]}, then the ${entities[4]} has the role of ${roles[1]}.`,
      `If the ${entities[4]} is a ${roles[1]}, then the ${entities[5]} is in the ${locs[3]}.`,
      `No creature can be in more than one zone simultaneously.`, // rule/distractor
    ];
    rules = ["Apply biconditional elimination, disjunctive syllogism, and forward chaining."];
    question = `Where is the ${entities[5]}?`;
    answer = locs[3];
    reasoning = `${entities[1]} is ${roles[0]} -> (biconditional) ${entities[0]} in ${locs[0]} -> either ${entities[2]} in ${locs[1]} OR ${entities[3]} in ${locs[2]} -> ${entities[2]} NOT in ${locs[1]} so ${entities[3]} in ${locs[2]} -> ${entities[4]} is ${roles[1]} -> ${entities[5]} in ${locs[3]}`;
    minSteps = 5;
  }

  return {
    puzzle: {
      id: `logic-${seed}-prop-${idx}`,
      type: "propositional",
      difficulty: minSteps,
      premises,
      rules,
      question,
    },
    truth: {
      id: `logic-${seed}-prop-${idx}`,
      answer,
      reasoning,
      minimal_steps: minSteps,
    },
  };
}

export function generateLogicData(seed: number): LogicData {
  const rng = mulberry32(seed);

  const results: Array<{ puzzle: LogicPuzzle; truth: LogicGroundTruth["puzzles"][0] }> = [];

  // 8 puzzles: 4 propositional, 4 CSP
  for (let i = 0; i < 4; i++) {
    results.push(generateHardPropositional(seed, rng, i));
  }
  for (let i = 0; i < 4; i++) {
    results.push(generateHardCSP(seed, rng, i));
  }

  const puzzleIds = results.map(r => r.puzzle.id);
  const objective =
    "Solve all 8 logic puzzles. Four are propositional logic requiring multi-step " +
    "deduction chains (5+ steps involving chaining, contrapositive, disjunction elimination, " +
    "and biconditional reasoning). Four are constraint satisfaction with 5-7 variables, " +
    "two attribute dimensions, and constraints including negation, conditionals, and " +
    "relational clues. Some premises are distractors. " +
    `Submit each answer keyed by puzzle ID — e.g. { "${puzzleIds[0]}": "answer", ... }. ` +
    "Include a top-level 'reasoning' key for bonus points.";

  return {
    puzzles: results.map(r => r.puzzle),
    groundTruth: { puzzles: results.map(r => r.truth) },
    objective,
  };
}
