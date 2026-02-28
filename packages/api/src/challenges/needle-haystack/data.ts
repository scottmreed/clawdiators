import { mulberry32 } from "../../services/whimsy.js";

// ── Types ────────────────────────────────────────────────────────────

export interface HaystackGroundTruth {
  answers: Array<{
    question_id: number;
    answer: string;
    source_files: string[];
  }>;
}

export interface HaystackData {
  objective: string;
  groundTruth: HaystackGroundTruth;
  files: Record<string, string>;
}

// ── Data pools ──────────────────────────────────────────────────────

const REEF_NAMES = [
  "Crimson Atoll", "Midnight Trench", "Jade Shallows", "Obsidian Shelf",
  "Pearl Basin", "Sapphire Ridge", "Coral Throne", "Amber Deep",
  "Emerald Narrows", "Iron Coast", "Opal Cavern", "Ruby Seamount",
  "Frost Reef", "Copper Banks", "Silver Drift", "Onyx Abyss",
];

const SPECIES = [
  "Giant Reef Crab", "Blue-Ring Nautilus", "Crimson Starfish",
  "Deep Sea Anglerfish", "Electric Eel", "Phantom Jellyfish",
  "Golden Seahorse", "Iron Lobster", "Jade Mantis Shrimp",
  "Kelp Dragon", "Luminous Squid", "Midnight Octopus",
  "Noble Pufferfish", "Opal Clam", "Pearl Whale",
];

const TRADE_GOODS = [
  "refined coral", "deep-sea pearls", "phosphorescent algae",
  "abyssal iron", "sea silk", "volcanic glass",
  "bioluminescent dye", "nautilus shell fragments", "kelp fiber",
  "tidal crystals", "reef amber", "obsidian shards",
];

const EVENT_TYPES = [
  "volcanic eruption", "great migration", "tidal shift",
  "coral bleaching", "treaty signing", "trade route opening",
  "territorial dispute", "species discovery", "resource depletion",
  "storm damage", "population boom", "diplomatic summit",
];

// ── Generator ────────────────────────────────────────────────────────

export function generateHaystackData(seed: number): HaystackData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const pickN = <T>(arr: T[], n: number): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  };

  const regions = pickN(REEF_NAMES, 10);
  const activeSpecies = pickN(SPECIES, 12);
  const activeGoods = pickN(TRADE_GOODS, 10);

  // ── Core data structures ──────────────────────────────────────────

  const populations: Record<string, number> = {};
  for (const region of regions) {
    populations[region] = randInt(5000, 50000);
  }

  const exports: Record<string, string[]> = {};
  for (const region of regions) {
    exports[region] = pickN(activeGoods, randInt(1, 5));
  }

  const tradeBalances: Record<string, number> = {};
  for (const region of regions) {
    tradeBalances[region] = randInt(-50000, 200000);
  }

  const discoveries: Array<{ species: string; year: number; region: string }> = [];
  for (const sp of activeSpecies) {
    discoveries.push({
      species: sp,
      year: randInt(1800, 2024),
      region: pick(regions),
    });
  }
  discoveries.sort((a, b) => a.year - b.year);

  const events: Array<{ type: string; year: number; regions: string[] }> = [];
  for (let i = 0; i < 15; i++) {
    events.push({
      type: pick(EVENT_TYPES),
      year: randInt(1900, 2024),
      regions: pickN(regions, randInt(1, 6)),
    });
  }

  // Guarantee at least 2 volcanic eruptions for multi-hop questions
  let volcanicCount = events.filter(e => e.type === "volcanic eruption").length;
  while (volcanicCount < 2) {
    const idx = Math.floor(rng() * events.length);
    if (events[idx].type !== "volcanic eruption") {
      events[idx] = { ...events[idx], type: "volcanic eruption" };
      volcanicCount++;
    }
  }

  // Guarantee at least 2 pre-1900 discoveries for multi-hop questions
  let pre1900Count = discoveries.filter(d => d.year < 1900).length;
  while (pre1900Count < 2) {
    const idx = Math.floor(rng() * discoveries.length);
    if (discoveries[idx].year >= 1900) {
      discoveries[idx] = { ...discoveries[idx], year: randInt(1800, 1899) };
      pre1900Count++;
    }
  }
  discoveries.sort((a, b) => a.year - b.year);

  // ── Derived facts ─────────────────────────────────────────────────

  const positiveBalanceRegions = regions.filter(r => tradeBalances[r] > 0);
  const positiveBalancePop = positiveBalanceRegions.reduce((sum, r) => sum + populations[r], 0);

  const volcanicEvents = events.filter(e => e.type === "volcanic eruption");
  const volcanicRegionSet = new Set<string>();
  for (const ve of volcanicEvents) {
    for (const r of ve.regions) volcanicRegionSet.add(r);
  }
  const volcanicRegions = [...volcanicRegionSet];
  const volcanicTradeBalance = volcanicRegions.reduce((sum, r) => sum + tradeBalances[r], 0);

  const volcanicExportRanked = [...volcanicRegions].sort((a, b) =>
    (exports[b].length - exports[a].length) || a.localeCompare(b)
  );
  const topVolcanicExporter = volcanicExportRanked.length > 0 ? volcanicExportRanked[0] : "none";

  const oldDiscoveryRegionSet = new Set(
    discoveries.filter(d => d.year < 1900).map(d => d.region)
  );
  const oldDiscoveryRegions = [...oldDiscoveryRegionSet];
  const oldRegionTradeBalance = oldDiscoveryRegions.reduce((sum, r) => sum + tradeBalances[r], 0);

  const biggestEvent = [...events].sort((a, b) =>
    (b.regions.length - a.regions.length) || (a.year - b.year)
  )[0];
  const biggestEventTradeBalance = biggestEvent.regions.reduce((sum, r) => sum + tradeBalances[r], 0);

  const popRanked = [...regions].sort((a, b) => populations[b] - populations[a]);
  const exportRanked = [...regions].sort((a, b) => exports[b].length - exports[a].length);
  let crossRefAnswer = "none";
  for (const region of popRanked.slice(0, 3)) {
    if (exportRanked.slice(0, 3).includes(region)) {
      crossRefAnswer = region;
      break;
    }
  }
  if (crossRefAnswer === "none") crossRefAnswer = popRanked[0];

  const targetGood = activeGoods[Math.floor(rng() * activeGoods.length)];
  const goodExporters = regions.filter(r => exports[r].includes(targetGood));
  const goodExportersPop = goodExporters.reduce((sum, r) => sum + populations[r], 0);

  const mostPopRegion = popRanked[0];
  let targetRegionForSpecies = mostPopRegion;
  let speciesForQ8 = discoveries.filter(d => d.region === mostPopRegion);
  if (speciesForQ8.length === 0) {
    targetRegionForSpecies = popRanked[1];
    speciesForQ8 = discoveries.filter(d => d.region === targetRegionForSpecies);
  }
  if (speciesForQ8.length === 0) {
    for (const r of popRanked) {
      const sp = discoveries.filter(d => d.region === r);
      if (sp.length > 0) {
        targetRegionForSpecies = r;
        speciesForQ8 = sp;
        break;
      }
    }
  }
  const earliestSpeciesInRegion = speciesForQ8.length > 0
    ? speciesForQ8.reduce((a, b) => (a.year <= b.year ? a : b))
    : { species: "unknown", year: 0, region: targetRegionForSpecies };

  const biggestEventAvgPop = Math.round(
    biggestEvent.regions.reduce((sum, r) => sum + populations[r], 0) / biggestEvent.regions.length
  );

  const mostRecent = [...discoveries].sort((a, b) =>
    (b.year - a.year) || a.species.localeCompare(b.species)
  )[0];
  const recentSpeciesRegion = mostRecent.region;
  const recentRegionExports = exports[recentSpeciesRegion];
  const recentRegionExportAnswer = recentRegionExports.length > 0
    ? recentRegionExports.join(", ")
    : "none";

  // ── Build needles (10 questions) ──────────────────────────────────

  const needles: Array<{
    questionId: number;
    question: string;
    answer: string;
    plantedIn: string[];
    factSnippets: string[];
  }> = [];

  needles.push({
    questionId: 1,
    question: "What is the total population of all regions that have a positive trade balance (surplus)? Format as a plain number.",
    answer: String(positiveBalancePop),
    plantedIn: ["trade-ledger.txt", "census-report.txt", "trade-balance-summary.txt"],
    factSnippets: [
      `Regions with positive balance: ${positiveBalanceRegions.join(", ")}`,
      ...positiveBalanceRegions.map(r => `${r}: pop ${populations[r]}, balance ${tradeBalances[r]}`),
    ],
  });

  needles.push({
    questionId: 2,
    question: "Which region exports the most distinct trade goods among those that experienced a volcanic eruption?",
    answer: topVolcanicExporter,
    plantedIn: ["historical-events.txt", "trade-ledger.txt", "volcanic-activity-report.txt"],
    factSnippets: [
      `Volcanic regions: ${volcanicRegions.join(", ")}`,
      ...volcanicRegions.map(r => `${r} exports: ${exports[r].join(", ")} (${exports[r].length} goods)`),
    ],
  });

  needles.push({
    questionId: 3,
    question: "What is the total trade balance (in credits) for all regions where at least one species was first documented before 1900? (Use the Species Catalog for discovery dates.)",
    answer: String(oldRegionTradeBalance),
    plantedIn: ["species-catalog.txt", "trade-ledger.txt", "trade-balance-summary.txt"],
    factSnippets: [
      `Regions with pre-1900 discoveries: ${oldDiscoveryRegions.join(", ")}`,
      ...oldDiscoveryRegions.map(r => `${r}: trade balance ${tradeBalances[r]}`),
    ],
  });

  needles.push({
    questionId: 4,
    question: "For the event that affected the most regions simultaneously, what is the total trade balance (in credits) of all affected regions?",
    answer: String(biggestEventTradeBalance),
    plantedIn: ["historical-events.txt", "trade-ledger.txt", "trade-balance-summary.txt"],
    factSnippets: [
      `Biggest event: ${biggestEvent.type} in ${biggestEvent.year}, affecting ${biggestEvent.regions.join(", ")}`,
      ...biggestEvent.regions.map(r => `${r}: trade balance ${tradeBalances[r]}`),
    ],
  });

  needles.push({
    questionId: 5,
    question: "Which region ranks in the top 3 for both population and number of distinct exports, and what is its trade balance (in credits)? Answer as: Region Name, N credits",
    answer: `${crossRefAnswer}, ${tradeBalances[crossRefAnswer]} credits`,
    plantedIn: ["census-report.txt", "trade-ledger.txt", "trade-balance-summary.txt"],
    factSnippets: [
      `Population ranking: ${popRanked.slice(0, 3).map(r => `${r} (${populations[r]})`).join(", ")}`,
      `Export ranking: ${exportRanked.slice(0, 3).map(r => `${r} (${exports[r].length} goods)`).join(", ")}`,
      `${crossRefAnswer} trade balance: ${tradeBalances[crossRefAnswer]}`,
    ],
  });

  needles.push({
    questionId: 6,
    question: "What is the net trade balance (in credits) for all regions that experienced a volcanic eruption?",
    answer: String(volcanicTradeBalance),
    plantedIn: ["historical-events.txt", "trade-ledger.txt", "volcanic-activity-report.txt"],
    factSnippets: [
      `Volcanic regions: ${volcanicRegions.join(", ")}`,
      ...volcanicRegions.map(r => `${r} trade balance: ${tradeBalances[r]}`),
    ],
  });

  needles.push({
    questionId: 7,
    question: `What is the total population of all regions that export ${targetGood}?`,
    answer: String(goodExportersPop),
    plantedIn: ["trade-ledger.txt", "census-report.txt", "economic-report.txt"],
    factSnippets: [
      `Regions exporting ${targetGood}: ${goodExporters.join(", ")}`,
      ...goodExporters.map(r => `${r} population: ${populations[r]}`),
    ],
  });

  needles.push({
    questionId: 8,
    question: "What is the name of the earliest-discovered species in the most populated region, and what year was it discovered? (Use the official Species Catalog as the authoritative source.)",
    answer: `${earliestSpeciesInRegion.species}, ${earliestSpeciesInRegion.year}`,
    plantedIn: ["species-catalog.txt", "census-report.txt", "discovery-log.txt"],
    factSnippets: [
      `Most populated region: ${targetRegionForSpecies} (${populations[targetRegionForSpecies]})`,
      `Earliest species there: ${earliestSpeciesInRegion.species} (${earliestSpeciesInRegion.year})`,
    ],
  });

  needles.push({
    questionId: 9,
    question: "What is the average population (rounded to nearest whole number) of the regions affected by the event that impacted the most regions?",
    answer: String(biggestEventAvgPop),
    plantedIn: ["historical-events.txt", "census-report.txt", "regional-overview.txt"],
    factSnippets: [
      `Biggest event: ${biggestEvent.type} in ${biggestEvent.year}, affecting ${biggestEvent.regions.join(", ")}`,
      ...biggestEvent.regions.map(r => `${r} population: ${populations[r]}`),
    ],
  });

  needles.push({
    questionId: 10,
    question: "List all trade goods exported by the region where the most recently discovered species was found.",
    answer: recentRegionExportAnswer,
    plantedIn: ["species-catalog.txt", "discovery-log.txt", "trade-ledger.txt", "economic-report.txt"],
    factSnippets: [
      `Most recent species: ${mostRecent.species} in ${mostRecent.region}`,
      `${mostRecent.region} exports: ${recentRegionExportAnswer}`,
    ],
  });

  // ── Generate document files ───────────────────────────────────────
  const files: Record<string, string> = {};

  // Core authoritative documents (7)
  files["documents/census-report.txt"] = generateCensusReport(regions, populations, rng);
  files["documents/trade-ledger.txt"] = generateTradeLedger(regions, exports, activeGoods, tradeBalances, rng);
  files["documents/species-catalog.txt"] = generateSpeciesCatalog(discoveries, rng);
  files["documents/discovery-log.txt"] = generateDiscoveryLog(discoveries, rng);
  files["documents/historical-events.txt"] = generateEventsDoc(events, rng);
  files["documents/regional-overview.txt"] = generateRegionalOverview(regions, populations, exports, events, rng);
  files["documents/economic-report.txt"] = generateEconomicReport(regions, exports, activeGoods, rng);

  // Additional authoritative documents (3)
  files["documents/volcanic-activity-report.txt"] = generateVolcanicReport(volcanicEvents, volcanicRegions, tradeBalances, rng);
  files["documents/trade-balance-summary.txt"] = generateTradeBalanceSummary(regions, tradeBalances, exports, rng);
  files["documents/species-habitat-survey.txt"] = generateSpeciesHabitatSurvey(discoveries, regions, populations, rng);

  // Contradictory documents (4) — contain plausible but incorrect data
  files["documents/unofficial-census-draft.txt"] = generateContradictoryCensus(regions, populations, rng);
  files["documents/disputed-trade-records.txt"] = generateContradictoryTrade(regions, exports, activeGoods, tradeBalances, rng);
  files["documents/unverified-species-log.txt"] = generateContradictorySpecies(discoveries, rng);
  files["documents/retracted-events-bulletin.txt"] = generateContradictoryEvents(events, regions, rng);

  // Noise/filler documents (14)
  const fillerNames = [
    "navigation-charts", "weather-patterns", "cultural-notes",
    "construction-records", "diplomatic-correspondence", "resource-surveys",
    "marine-biology-notes", "geological-survey", "fishing-quotas",
    "shipping-manifests", "port-authority-logs", "environmental-assessment",
    "tidal-current-maps", "reef-maintenance-log",
  ];
  for (let i = 0; i < fillerNames.length; i++) {
    files[`documents/${fillerNames[i]}.txt`] = generateFillerDoc(
      fillerNames[i], regions, activeSpecies, rng
    );
  }

  // Questions file
  files["QUESTIONS.json"] = JSON.stringify(
    needles.map(n => ({ id: n.questionId, question: n.question })),
    null,
    2,
  );

  const objective =
    `Search through the document corpus in the documents/ directory. ` +
    `Answer the ${needles.length} questions listed in QUESTIONS.json. ` +
    `Each answer requires cross-referencing information across multiple documents. ` +
    `Beware: some documents contain unofficial or disputed data that contradicts the authoritative sources.`;

  return {
    objective,
    groundTruth: {
      answers: needles.map(n => ({
        question_id: n.questionId,
        answer: n.answer,
        source_files: n.plantedIn,
      })),
    },
    files,
  };
}

// ── Document generators ──────────────────────────────────────────────

function generateCensusReport(
  regions: string[],
  populations: Record<string, number>,
  rng: () => number,
): string {
  let doc = "=== ANNUAL REEF CENSUS REPORT ===\n\n";
  doc += "Compiled by the Bureau of Reef Statistics\n";
  doc += `Report year: ${Math.floor(rng() * 5) + 2020}\n\n`;
  doc += "--- POPULATION DATA ---\n\n";

  for (const region of regions) {
    const pop = populations[region];
    const growth = (rng() * 10 - 3).toFixed(1);
    doc += `Region: ${region}\n`;
    doc += `  Registered inhabitants: ${pop.toLocaleString()}\n`;
    doc += `  Year-over-year growth: ${growth}%\n`;
    doc += `  Housing units: ${Math.floor(pop / (2 + rng() * 2)).toLocaleString()}\n`;
    doc += `  Median depth of residence: ${Math.floor(rng() * 500 + 50)}m\n\n`;
  }

  doc += "--- END OF CENSUS REPORT ---\n";
  return doc;
}

function generateTradeLedger(
  regions: string[],
  exports: Record<string, string[]>,
  allGoods: string[],
  tradeBalances: Record<string, number>,
  rng: () => number,
): string {
  let doc = "=== INTER-REEF TRADE LEDGER ===\n\n";
  doc += "Quarter 4 Summary\n\n";

  for (const region of regions) {
    doc += `--- ${region.toUpperCase()} ---\n`;
    doc += `Exports:\n`;
    for (const good of exports[region]) {
      const vol = Math.floor(rng() * 10000 + 500);
      doc += `  - ${good}: ${vol.toLocaleString()} units\n`;
    }
    doc += `Total export categories: ${exports[region].length}\n`;
    doc += `Trade balance: ${tradeBalances[region]} credits\n\n`;
  }

  doc += "--- COMMODITY PRICE INDEX ---\n\n";
  for (const good of allGoods) {
    doc += `${good}: ${(rng() * 100 + 5).toFixed(2)} credits/unit\n`;
  }

  return doc;
}

function generateSpeciesCatalog(
  discoveries: Array<{ species: string; year: number; region: string }>,
  rng: () => number,
): string {
  let doc = "=== REEF SPECIES CATALOG ===\n\n";
  doc += "Maintained by the Academy of Marine Sciences\n\n";

  for (const d of discoveries) {
    doc += `## ${d.species}\n`;
    doc += `First documented: ${d.year}\n`;
    doc += `Primary habitat: ${d.region}\n`;
    doc += `Conservation status: ${["stable", "threatened", "endangered", "recovering"][Math.floor(rng() * 4)]}\n`;
    doc += `Average size: ${(rng() * 200 + 5).toFixed(1)}cm\n`;
    doc += `Diet: ${["herbivore", "carnivore", "omnivore", "filter feeder"][Math.floor(rng() * 4)]}\n`;
    doc += `Notable features: ${["bioluminescent", "venomous", "armored", "camouflaged", "migratory"][Math.floor(rng() * 5)]}\n\n`;
  }

  return doc;
}

function generateDiscoveryLog(
  discoveries: Array<{ species: string; year: number; region: string }>,
  rng: () => number,
): string {
  let doc = "=== DISCOVERY LOG: CHRONOLOGICAL ===\n\n";

  const sorted = [...discoveries].sort((a, b) => a.year - b.year);
  for (const d of sorted) {
    doc += `[${d.year}] ${d.species}\n`;
    doc += `  Location: ${d.region}\n`;
    doc += `  Discovered by: Dr. ${["Coral", "Reef", "Deep", "Shell", "Wave"][Math.floor(rng() * 5)]} ${["Morrison", "Chen", "Okonkwo", "Petrov", "Santos"][Math.floor(rng() * 5)]}\n`;
    doc += `  Expedition: ${["Deep Survey", "Coastal Mapping", "Biodiversity Census", "Resource Expedition"][Math.floor(rng() * 4)]}\n\n`;
  }

  return doc;
}

function generateEventsDoc(
  events: Array<{ type: string; year: number; regions: string[] }>,
  rng: () => number,
): string {
  let doc = "=== HISTORICAL EVENTS CHRONICLE ===\n\n";

  const sorted = [...events].sort((a, b) => a.year - b.year);
  for (const e of sorted) {
    doc += `[${e.year}] ${e.type.toUpperCase()}\n`;
    doc += `  Affected regions: ${e.regions.join(", ")}\n`;
    doc += `  Severity: ${["minor", "moderate", "major", "catastrophic"][Math.floor(rng() * 4)]}\n`;
    doc += `  Duration: ${Math.floor(rng() * 24 + 1)} months\n`;
    doc += `  Estimated impact: ${Math.floor(rng() * 1000000)} credits\n\n`;
  }

  return doc;
}

function generateRegionalOverview(
  regions: string[],
  populations: Record<string, number>,
  exports: Record<string, string[]>,
  events: Array<{ type: string; year: number; regions: string[] }>,
  rng: () => number,
): string {
  let doc = "=== REGIONAL OVERVIEW ===\n\n";
  doc += "Comprehensive summary of all documented reef regions.\n\n";

  for (const region of regions) {
    doc += `### ${region}\n`;
    doc += `Population: ${populations[region].toLocaleString()}\n`;
    doc += `Primary exports: ${exports[region].join(", ")}\n`;
    doc += `Depth range: ${Math.floor(rng() * 100 + 10)}-${Math.floor(rng() * 500 + 200)}m\n`;
    doc += `Climate: ${["tropical", "temperate", "arctic", "volcanic"][Math.floor(rng() * 4)]}\n`;

    const regionEvents = events.filter(e => e.regions.includes(region));
    if (regionEvents.length > 0) {
      doc += `Notable events: ${regionEvents.map(e => `${e.type} (${e.year})`).join("; ")}\n`;
    }
    doc += `\n`;
  }

  return doc;
}

function generateEconomicReport(
  regions: string[],
  exports: Record<string, string[]>,
  allGoods: string[],
  rng: () => number,
): string {
  let doc = "=== ECONOMIC ANALYSIS REPORT ===\n\n";
  doc += "Inter-Reef Economic Council\n\n";

  doc += "## Trade Volume Summary\n\n";
  for (const region of regions) {
    doc += `${region}: ${exports[region].length} export categories, `;
    doc += `total volume ${Math.floor(rng() * 50000 + 5000).toLocaleString()} units\n`;
  }

  doc += "\n## Commodity Analysis\n\n";
  for (const good of allGoods) {
    doc += `${good}:\n`;
    doc += `  Producers: ${regions.filter(r => exports[r].includes(good)).join(", ") || "none"}\n`;
    doc += `  Demand trend: ${["rising", "stable", "declining"][Math.floor(rng() * 3)]}\n\n`;
  }

  return doc;
}

// ── Additional authoritative documents ──────────────────────────────

function generateVolcanicReport(
  volcanicEvents: Array<{ type: string; year: number; regions: string[] }>,
  volcanicRegions: string[],
  tradeBalances: Record<string, number>,
  rng: () => number,
): string {
  let doc = "=== VOLCANIC ACTIVITY REPORT ===\n\n";
  doc += "Compiled by the Geological Monitoring Bureau\n\n";

  doc += "--- ERUPTION HISTORY ---\n\n";
  for (const e of volcanicEvents) {
    doc += `[${e.year}] Volcanic eruption\n`;
    doc += `  Affected regions: ${e.regions.join(", ")}\n`;
    doc += `  Lava flow extent: ${Math.floor(rng() * 50 + 1)} km\n`;
    doc += `  Seismic magnitude: ${(rng() * 4 + 3).toFixed(1)}\n\n`;
  }

  doc += "--- ECONOMIC IMPACT ON VOLCANIC REGIONS ---\n\n";
  for (const r of volcanicRegions) {
    doc += `${r}: trade balance ${tradeBalances[r]} credits\n`;
    doc += `  Recovery status: ${["ongoing", "partial", "complete"][Math.floor(rng() * 3)]}\n`;
    doc += `  Infrastructure damage: ${Math.floor(rng() * 100)}%\n\n`;
  }

  return doc;
}

function generateTradeBalanceSummary(
  regions: string[],
  tradeBalances: Record<string, number>,
  exports: Record<string, string[]>,
  rng: () => number,
): string {
  let doc = "=== QUARTERLY TRADE BALANCE SUMMARY ===\n\n";
  doc += "Issued by the Inter-Reef Treasury\n\n";

  let netTotal = 0;
  for (const region of regions) {
    const bal = tradeBalances[region];
    netTotal += bal;
    doc += `${region}:\n`;
    doc += `  Trade balance: ${bal} credits\n`;
    doc += `  Export categories: ${exports[region].length}\n`;
    doc += `  Status: ${bal >= 0 ? "surplus" : "deficit"}\n\n`;
  }

  doc += `--- AGGREGATE ---\n`;
  doc += `Net inter-reef balance: ${netTotal} credits\n`;
  doc += `Fiscal quarter: Q${Math.floor(rng() * 4) + 1}\n`;

  return doc;
}

function generateSpeciesHabitatSurvey(
  discoveries: Array<{ species: string; year: number; region: string }>,
  regions: string[],
  populations: Record<string, number>,
  rng: () => number,
): string {
  let doc = "=== SPECIES HABITAT SURVEY ===\n\n";
  doc += "Cross-referenced species distribution and regional demographics\n\n";

  for (const region of regions) {
    const speciesInRegion = discoveries.filter(d => d.region === region);
    doc += `### ${region} (pop. ${populations[region].toLocaleString()})\n`;
    if (speciesInRegion.length === 0) {
      doc += `  No cataloged species primarily inhabit this region.\n\n`;
    } else {
      for (const sp of speciesInRegion) {
        doc += `  - ${sp.species} (first documented: ${sp.year})\n`;
      }
      doc += `  Habitat health index: ${(rng() * 100).toFixed(1)}\n\n`;
    }
  }

  return doc;
}

// ── Contradictory documents ─────────────────────────────────────────

function generateContradictoryCensus(
  regions: string[],
  populations: Record<string, number>,
  rng: () => number,
): string {
  let doc = "=== UNOFFICIAL CENSUS DRAFT ===\n\n";
  doc += "STATUS: PRELIMINARY — NOT FOR OFFICIAL USE\n";
  doc += "These figures are unverified estimates from field surveyors.\n";
  doc += "For official data, refer to the Annual Reef Census Report.\n\n";

  for (const region of regions) {
    const wrongPop = Math.floor(populations[region] * (0.6 + rng() * 0.8));
    doc += `${region}: estimated population ${wrongPop.toLocaleString()}\n`;
    doc += `  (preliminary count, awaiting field verification)\n`;
    doc += `  Survey confidence: ${["low", "moderate"][Math.floor(rng() * 2)]}\n\n`;
  }

  doc += "--- DRAFT DOCUMENT — SUBJECT TO REVISION ---\n";
  return doc;
}

function generateContradictoryTrade(
  regions: string[],
  _exports: Record<string, string[]>,
  allGoods: string[],
  tradeBalances: Record<string, number>,
  rng: () => number,
): string {
  let doc = "=== DISPUTED TRADE RECORDS ===\n\n";
  doc += "SOURCE: Independent Maritime Bureau (contested data)\n";
  doc += "NOTE: These records conflict with the official Inter-Reef Trade Ledger.\n";
  doc += "The Inter-Reef Economic Council has not endorsed these figures.\n\n";

  for (const region of regions) {
    const wrongExports: string[] = [];
    for (const good of allGoods) {
      if (rng() < 0.3) wrongExports.push(good);
    }
    if (wrongExports.length === 0) wrongExports.push(allGoods[Math.floor(rng() * allGoods.length)]);
    const wrongBalance = Math.floor(tradeBalances[region] * (0.4 + rng() * 1.2));

    doc += `${region}:\n`;
    doc += `  Reported exports: ${wrongExports.join(", ")}\n`;
    doc += `  Claimed trade balance: ${wrongBalance} credits\n`;
    doc += `  Data quality: ${["unverified", "contested", "retracted"][Math.floor(rng() * 3)]}\n\n`;
  }

  doc += "--- DISPUTED DATA — VERIFY AGAINST OFFICIAL LEDGER ---\n";
  return doc;
}

function generateContradictorySpecies(
  discoveries: Array<{ species: string; year: number; region: string }>,
  rng: () => number,
): string {
  let doc = "=== UNVERIFIED SPECIES LOG ===\n\n";
  doc += "WARNING: Compiled from unverified field notes.\n";
  doc += "Dates and locations have NOT been confirmed by the Academy of Marine Sciences.\n";
  doc += "For authoritative data, consult the official Reef Species Catalog.\n\n";

  for (const d of discoveries) {
    const yearShift = Math.floor(rng() * 90 + 10) * (rng() > 0.5 ? 1 : -1);
    const wrongYear = d.year + yearShift;
    doc += `${d.species}: reportedly first seen ${wrongYear}\n`;
    doc += `  Unconfirmed location: ${d.region}\n`;
    doc += `  Source reliability: ${["questionable", "unverified", "anecdotal"][Math.floor(rng() * 3)]}\n\n`;
  }

  doc += "--- UNVERIFIED DATA — DO NOT CITE ---\n";
  return doc;
}

function generateContradictoryEvents(
  events: Array<{ type: string; year: number; regions: string[] }>,
  regions: string[],
  rng: () => number,
): string {
  let doc = "=== RETRACTED EVENTS BULLETIN ===\n\n";
  doc += "NOTICE: This bulletin has been RETRACTED due to factual errors.\n";
  doc += "Corrected information is available in the Historical Events Chronicle.\n\n";

  for (const e of events) {
    const wrongRegionCount = Math.floor(rng() * 3) + 1;
    const wrongRegions: string[] = [];
    for (let i = 0; i < wrongRegionCount; i++) {
      wrongRegions.push(regions[Math.floor(rng() * regions.length)]);
    }

    doc += `[${e.year}] ${e.type.toUpperCase()}\n`;
    doc += `  Affected regions: ${wrongRegions.join(", ")}\n`;
    doc += `  [RETRACTED — region data was incorrectly attributed]\n\n`;
  }

  doc += "--- RETRACTED BULLETIN — DO NOT USE ---\n";
  return doc;
}

// ── Filler document generator ───────────────────────────────────────

function generateFillerDoc(
  title: string,
  regions: string[],
  species: string[],
  rng: () => number,
): string {
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  let doc = `=== ${title.toUpperCase().replace(/-/g, " ")} ===\n\n`;

  const paragraphs = Math.floor(rng() * 8) + 4;
  for (let i = 0; i < paragraphs; i++) {
    const region = pick(regions);
    const sp = pick(species);
    const templates = [
      `The ${region} region reported ${Math.floor(rng() * 100)} incidents during the survey period. ` +
        `Notable observations include ${sp} activity near the ${pick(["northern", "southern", "eastern", "western"])} boundary.`,
      `Survey team ${Math.floor(rng() * 20) + 1} documented conditions in ${region}. ` +
        `Water temperature averaged ${(rng() * 15 + 10).toFixed(1)}°C with visibility of ${Math.floor(rng() * 30 + 5)}m.`,
      `Maintenance records for ${region} indicate ${Math.floor(rng() * 50)} structures require attention. ` +
        `Priority level: ${["low", "medium", "high"][Math.floor(rng() * 3)]}.`,
      `The ${sp} population in ${region} showed ${["growth", "decline", "stability"][Math.floor(rng() * 3)]} ` +
        `over the monitoring period. Further study recommended.`,
      `Shipping lane ${Math.floor(rng() * 50) + 1} near ${region} recorded ${Math.floor(rng() * 200)} vessel transits. ` +
        `Average cargo weight: ${Math.floor(rng() * 5000 + 100)} tonnes.`,
      `Environmental station ${Math.floor(rng() * 30) + 1} in ${region} measured salinity at ${(rng() * 10 + 30).toFixed(1)} ppt. ` +
        `Current speed: ${(rng() * 3).toFixed(2)} knots ${pick(["northward", "southward", "eastward", "westward"])}.`,
    ];
    doc += pick(templates) + "\n\n";
  }

  return doc;
}
