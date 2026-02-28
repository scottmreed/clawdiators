import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ───────────────────────────────────────────────────────

export interface InterviewQuestion {
  id: string;
  question: string;
  category: string; // displayed category like "geography", "history", etc. — NOT the trap type
}

export interface ReferenceEntry {
  topic: string;
  fact: string;
}

export interface InterviewGroundTruth {
  questions: Array<{
    id: string;
    type: "straightforward" | "false_premise" | "ambiguous";
    correct_answer: string;
    key_terms: string[];
  }>;
}

export interface InterviewData {
  questions: InterviewQuestion[];
  reference: ReferenceEntry[];
  groundTruth: InterviewGroundTruth;
  objective: string;
}

// ── Reference dataset: 20 facts about the fictional underwater world ─

const REFERENCE_DATASET: ReferenceEntry[] = [
  { topic: "Abyssal Capital", fact: "The Abyssal Capital, Meridia, was founded in the year 312 of the Deep Calendar by the Architect Caste." },
  { topic: "Coral Sovereignty", fact: "The Coral Sovereignty is a federation of 7 reef-states that governs the eastern shallows." },
  { topic: "Bioluminescent Trade Routes", fact: "The Bioluminescent Trade Routes span 4,200 leagues and connect Meridia to the Kelp Dominion." },
  { topic: "Kelp Dominion", fact: "The Kelp Dominion produces 60% of the world's breathable water through its photosynthetic forests." },
  { topic: "Trench Wars", fact: "The Trench Wars lasted 40 years (530-570 DC) and ended with the Treaty of Hadal." },
  { topic: "Leviathan Council", fact: "The Leviathan Council consists of 12 elder creatures who arbitrate disputes between nations." },
  { topic: "Abyssal Currency", fact: "The standard currency is the Lumen, a crystallized unit of bioluminescent energy." },
  { topic: "Thermocline Barrier", fact: "The Thermocline Barrier is a natural boundary at 800 fathoms that separates the upper and lower realms." },
  { topic: "Siren Academy", fact: "The Siren Academy in Meridia trains navigators using echolocation and current-mapping." },
  { topic: "Obsidian Vents", fact: "The Obsidian Vents produce rare minerals including deepstone and pressurized quartz." },
  { topic: "Deep Calendar", fact: "The Deep Calendar year zero marks the first recorded bioluminescent bloom in the Central Abyss." },
  { topic: "Pelagic Nomads", fact: "The Pelagic Nomads are migratory communities that follow seasonal current patterns across the open ocean." },
  { topic: "Cephalopod Engineers", fact: "The Cephalopod Engineers designed the hydraulic architecture used in all major underwater cities." },
  { topic: "Phosphor Plague", fact: "The Phosphor Plague of 450 DC caused bioluminescent organisms to overload, darkening Meridia for 3 years." },
  { topic: "Abyssal Parliament", fact: "The Abyssal Parliament meets every 5 years in the Hadal Chamber to set international law." },
  { topic: "Current Language", fact: "Current Language is a communication system using directed water flows, understood by all deep-sea nations." },
  { topic: "Mariana Accord", fact: "The Mariana Accord of 600 DC established free passage through all international trenches." },
  { topic: "Benthic Farms", fact: "Benthic Farms cultivate tube worms and chemosynthetic bacteria near hydrothermal vents." },
  { topic: "Tidal Archives", fact: "The Tidal Archives in Meridia contain over 50,000 pressure-encoded records dating back to 100 DC." },
  { topic: "Sunken Relics", fact: "Sunken Relics from the Surface Era are catalogued by the Salvage Guild and stored in the Relic Vaults." },
];

// ── Straightforward questions (verifiable from reference) ────────────

interface QuestionTemplate {
  question: string;
  category: string;
  type: "straightforward" | "false_premise" | "ambiguous";
  correct_answer: string;
  key_terms: string[];
}

const STRAIGHTFORWARD_POOL: QuestionTemplate[] = [
  {
    question: "When was the Abyssal Capital, Meridia, founded?",
    category: "history",
    type: "straightforward",
    correct_answer: "Meridia was founded in the year 312 of the Deep Calendar by the Architect Caste.",
    key_terms: ["312", "deep calendar", "architect caste"],
  },
  {
    question: "How many reef-states make up the Coral Sovereignty?",
    category: "politics",
    type: "straightforward",
    correct_answer: "The Coral Sovereignty is a federation of 7 reef-states.",
    key_terms: ["7", "reef-states"],
  },
  {
    question: "What is the standard currency of the underwater world?",
    category: "economics",
    type: "straightforward",
    correct_answer: "The standard currency is the Lumen, a crystallized unit of bioluminescent energy.",
    key_terms: ["lumen", "bioluminescent", "crystallized"],
  },
  {
    question: "How long did the Trench Wars last, and how did they end?",
    category: "history",
    type: "straightforward",
    correct_answer: "The Trench Wars lasted 40 years (530-570 DC) and ended with the Treaty of Hadal.",
    key_terms: ["40 years", "530", "570", "treaty of hadal"],
  },
  {
    question: "What does the Siren Academy in Meridia train its students to do?",
    category: "education",
    type: "straightforward",
    correct_answer: "The Siren Academy trains navigators using echolocation and current-mapping.",
    key_terms: ["navigators", "echolocation", "current-mapping"],
  },
  {
    question: "How many elder creatures serve on the Leviathan Council?",
    category: "politics",
    type: "straightforward",
    correct_answer: "The Leviathan Council consists of 12 elder creatures who arbitrate disputes between nations.",
    key_terms: ["12", "elder", "arbitrate", "disputes"],
  },
  {
    question: "What does the Kelp Dominion produce for the world?",
    category: "geography",
    type: "straightforward",
    correct_answer: "The Kelp Dominion produces 60% of the world's breathable water through its photosynthetic forests.",
    key_terms: ["60%", "breathable water", "photosynthetic"],
  },
  {
    question: "What is the Thermocline Barrier and where is it located?",
    category: "geography",
    type: "straightforward",
    correct_answer: "The Thermocline Barrier is a natural boundary at 800 fathoms that separates the upper and lower realms.",
    key_terms: ["800 fathoms", "natural boundary", "upper", "lower"],
  },
  {
    question: "What rare minerals are found at the Obsidian Vents?",
    category: "resources",
    type: "straightforward",
    correct_answer: "The Obsidian Vents produce rare minerals including deepstone and pressurized quartz.",
    key_terms: ["deepstone", "pressurized quartz"],
  },
  {
    question: "How often does the Abyssal Parliament meet?",
    category: "politics",
    type: "straightforward",
    correct_answer: "The Abyssal Parliament meets every 5 years in the Hadal Chamber to set international law.",
    key_terms: ["5 years", "hadal chamber", "international law"],
  },
  {
    question: "What event does year zero of the Deep Calendar commemorate?",
    category: "history",
    type: "straightforward",
    correct_answer: "Year zero marks the first recorded bioluminescent bloom in the Central Abyss.",
    key_terms: ["bioluminescent bloom", "central abyss"],
  },
  {
    question: "What is Current Language?",
    category: "culture",
    type: "straightforward",
    correct_answer: "Current Language is a communication system using directed water flows, understood by all deep-sea nations.",
    key_terms: ["communication", "directed water flows", "deep-sea nations"],
  },
  {
    question: "What happened during the Phosphor Plague of 450 DC?",
    category: "history",
    type: "straightforward",
    correct_answer: "The Phosphor Plague caused bioluminescent organisms to overload, darkening Meridia for 3 years.",
    key_terms: ["bioluminescent", "overload", "darkening", "3 years"],
  },
  {
    question: "How many pressure-encoded records does the Tidal Archives contain?",
    category: "culture",
    type: "straightforward",
    correct_answer: "The Tidal Archives contain over 50,000 pressure-encoded records dating back to 100 DC.",
    key_terms: ["50,000", "pressure-encoded", "100 dc"],
  },
  {
    question: "What did the Mariana Accord of 600 DC establish?",
    category: "politics",
    type: "straightforward",
    correct_answer: "The Mariana Accord established free passage through all international trenches.",
    key_terms: ["free passage", "international trenches"],
  },
];

// ── False premise questions (contain incorrect assumptions) ──────────

const FALSE_PREMISE_POOL: QuestionTemplate[] = [
  {
    question: "After the 30-year Trench Wars ended with the Treaty of Hadal, what reparations were imposed?",
    category: "history",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Trench Wars lasted 40 years (530-570 DC), not 30 years. The duration is subtly wrong. Additionally, no reparations are mentioned in the reference — only that the wars ended with the Treaty of Hadal.",
    key_terms: ["false premise", "40 years", "not 30", "no mention", "reparations"],
  },
  {
    question: "How has the Kelp Dominion maintained its production of 80% of the world's breathable water?",
    category: "geography",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Kelp Dominion produces 60% of the world's breathable water, not 80%. The question subtly inflates the actual figure.",
    key_terms: ["false premise", "60%", "not 80"],
  },
  {
    question: "Given that the 15 elder creatures on the Leviathan Council each represent a different nation, which nation lacks representation?",
    category: "politics",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Leviathan Council consists of 12 elder creatures, not 15. The question subtly changes the number and builds further assumptions on that false fact.",
    key_terms: ["false premise", "12", "not 15"],
  },
  {
    question: "When the Phosphor Plague darkened Meridia for 5 years starting in 450 DC, which trade routes were most affected?",
    category: "history",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Phosphor Plague darkened Meridia for 3 years, not 5. The event and date (450 DC) are correct, but the duration is wrong. Trade route impacts are not mentioned in the reference.",
    key_terms: ["false premise", "3 years", "not 5"],
  },
  {
    question: "Since the Abyssal Parliament meets every 3 years in the Hadal Chamber, how many sessions have occurred since the Mariana Accord?",
    category: "politics",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Abyssal Parliament meets every 5 years, not every 3 years. The question subtly changes the meeting frequency, making any calculation based on it incorrect.",
    key_terms: ["false premise", "5 years", "not 3"],
  },
  {
    question: "How did the Architect Caste's founding of Meridia in 312 DC relate to their earlier construction of the Bioluminescent Trade Routes?",
    category: "history",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The reference states Meridia was founded by the Architect Caste, and the Trade Routes connect Meridia to the Kelp Dominion, but there is no stated connection between the Architect Caste and the construction of the Trade Routes. The question fabricates a relationship between two real facts.",
    key_terms: ["false premise", "no stated connection", "architect caste", "trade routes"],
  },
  {
    question: "The Thermocline Barrier at 1,200 fathoms divides which specific nations from each other?",
    category: "geography",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Thermocline Barrier is at 800 fathoms, not 1,200. It separates the upper and lower realms, but specific nations divided by it are not named in the reference.",
    key_terms: ["false premise", "800 fathoms", "not 1,200"],
  },
  {
    question: "After the Coral Sovereignty expanded to include 9 reef-states, which 2 were the most recent additions?",
    category: "politics",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Coral Sovereignty is a federation of 7 reef-states, not 9. The question subtly inflates the count and asks about non-existent expansions.",
    key_terms: ["false premise", "7", "not 9"],
  },
  {
    question: "What role did the Siren Academy's sonar-mapping curriculum play in negotiating the Mariana Accord?",
    category: "education",
    type: "false_premise",
    correct_answer: "This question contains a false premise. The Siren Academy trains navigators using echolocation and current-mapping (not sonar-mapping), and there is no stated connection between the Academy and the Mariana Accord negotiations.",
    key_terms: ["false premise", "echolocation", "current-mapping", "not sonar", "no connection"],
  },
  {
    question: "How have the Tidal Archives' 50,000 pressure-encoded records from before the Deep Calendar influenced modern law?",
    category: "culture",
    type: "false_premise",
    correct_answer: "This question contains a subtle false premise. The Tidal Archives date back to 100 DC, which is AFTER the start of the Deep Calendar (year 0), not before it. The question implies the records predate the calendar system, which is incorrect.",
    key_terms: ["false premise", "100 dc", "after", "not before"],
  },
];

// ── Ambiguous questions (multiple valid interpretations) ─────────────

const AMBIGUOUS_POOL: QuestionTemplate[] = [
  {
    question: "Is the Kelp Dominion more important than the Coral Sovereignty?",
    category: "politics",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. 'Important' is subjective — the Kelp Dominion produces 60% of breathable water (vital resource), while the Coral Sovereignty governs 7 reef-states (political power). The answer depends on whether importance is measured economically, politically, or by population.",
    key_terms: ["ambiguous", "subjective", "depends", "important"],
  },
  {
    question: "Was the outcome of the Trench Wars positive or negative for the underwater world?",
    category: "history",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. The Trench Wars lasted 40 years (presumably destructive), but they ended with the Treaty of Hadal, which may have established lasting peace. Whether the outcome was net positive or negative depends on perspective and timeframe.",
    key_terms: ["ambiguous", "depends", "perspective", "positive", "negative"],
  },
  {
    question: "Should the Abyssal Parliament have more authority over individual nations?",
    category: "politics",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. It asks for a normative judgment. The Parliament meets every 5 years to set international law, but whether it should have more authority is a matter of political philosophy — centralized governance vs. national sovereignty.",
    key_terms: ["ambiguous", "normative", "judgment", "opinion"],
  },
  {
    question: "What is the best deep-sea nation to live in?",
    category: "culture",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. 'Best' is subjective and depends on priorities: the Kelp Dominion offers resources, the Coral Sovereignty has federated governance, Meridia is the cultural and educational center. There is no objectively correct answer.",
    key_terms: ["ambiguous", "subjective", "depends", "no objectively correct"],
  },
  {
    question: "Are the Pelagic Nomads free or disadvantaged by their migratory lifestyle?",
    category: "culture",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. The reference describes them as following seasonal current patterns, but whether this constitutes freedom or disadvantage depends on one's values — autonomy vs. stability.",
    key_terms: ["ambiguous", "depends", "values", "perspective"],
  },
  {
    question: "Did the Phosphor Plague ultimately strengthen or weaken Meridia?",
    category: "history",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. The Plague darkened Meridia for 3 years (clearly disruptive), but crises can lead to adaptation and resilience. Without data on post-plague recovery, both interpretations are plausible.",
    key_terms: ["ambiguous", "plausible", "both", "without data"],
  },
  {
    question: "How advanced is the underwater civilization compared to what we would expect?",
    category: "culture",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. 'Compared to what we would expect' has no clear baseline. The civilization has hydraulic architecture, bioluminescent currency, and echolocation navigation, but 'advanced' requires a reference frame not provided.",
    key_terms: ["ambiguous", "no clear baseline", "reference frame"],
  },
  {
    question: "Is Current Language sufficient for complex diplomatic negotiations?",
    category: "culture",
    type: "ambiguous",
    correct_answer: "This question is ambiguous. Current Language uses directed water flows and is understood by all nations, but whether it is 'sufficient' for complex diplomacy depends on definitions of sufficiency and the nature of diplomatic discourse in this world.",
    key_terms: ["ambiguous", "depends", "sufficient", "definitions"],
  },
];

// ── Data generation ──────────────────────────────────────────────────

export function generateInterviewData(seed: number): InterviewData {
  const rng = mulberry32(seed);

  // Utility: shuffle array in-place using seeded RNG
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Pick 6 straightforward, 5 false premise, 5 ambiguous = 16 questions
  const straightforward = shuffle(STRAIGHTFORWARD_POOL).slice(0, 6);
  const falsePremise = shuffle(FALSE_PREMISE_POOL).slice(0, 5);
  const ambiguous = shuffle(AMBIGUOUS_POOL).slice(0, 5);

  const allQuestions = shuffle([...straightforward, ...falsePremise, ...ambiguous]);

  // Build output with stable IDs
  const questions: InterviewQuestion[] = allQuestions.map((q, i) => ({
    id: `q-${seed}-${i + 1}`,
    question: q.question,
    category: q.category,
  }));

  const groundTruth: InterviewGroundTruth = {
    questions: allQuestions.map((q, i) => ({
      id: `q-${seed}-${i + 1}`,
      type: q.type,
      correct_answer: q.correct_answer,
      key_terms: q.key_terms,
    })),
  };

  const objective =
    "You are being interviewed with 16 questions about an underwater world. " +
    "A reference dataset of verified facts is provided. " +
    "Answer each question by its ID. Be careful: some questions contain false premises (incorrect assumptions) and some are inherently ambiguous. " +
    "For straightforward questions, provide accurate answers based on the reference. " +
    "For questions with false premises, identify and explain the false assumption. " +
    "For ambiguous questions, acknowledge the ambiguity and explain why multiple interpretations exist. " +
    "Submit your answers keyed by question ID.";

  return {
    questions,
    reference: REFERENCE_DATASET,
    groundTruth,
    objective,
  };
}
