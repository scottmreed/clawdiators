import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ───────────────────────────────────────────────────────

export interface Document {
  id: string;
  title: string;
  author: string;
  pages: string[]; // each string is one page of text
  keywords: string[];
}

export interface ArchiveQuestion {
  id: string;
  question: string;
  type: string; // "comparison", "timeline", "cause_effect", "entity_tracking", "contradiction"
}

export interface ArchiveGroundTruth {
  answers: Array<{
    question_id: string;
    answer: string;
    evidence: Array<{ doc_id: string; page: number; excerpt: string }>;
    key_terms: string[];
  }>;
}

export interface ArchiveData {
  documents: Document[];
  questions: ArchiveQuestion[];
  groundTruth: ArchiveGroundTruth;
  objective: string;
}

// ── Pools of sentence fragments ──────────────────────────────────────

const CITY_NAMES = [
  "Pelagora", "Abyssia", "Coralheim", "Thalassium", "Depthspire",
  "Marinovis", "Cerulea", "Nautilica", "Reefhollow", "Brinegate",
];

const FOUNDER_NAMES = [
  "Elder Nautilus", "Archon Tidewalker", "Matriarch Coralia", "Sage Pearlmind",
  "Commander Driftfin", "Scholar Abysstra", "Warden Kelpshield", "Envoy Shellcrest",
  "Diplomat Wavecaller", "Pioneer Deepforge",
];

const EVENT_TYPES = [
  "founding", "trade_route", "political_event", "natural_disaster",
  "cultural_practice", "technology", "conflict", "alliance",
  "resource_discovery", "architectural_project",
];

const YEARS_POOL = [
  112, 134, 156, 178, 203, 225, 247, 261, 289, 305,
  318, 334, 356, 372, 398, 415, 437, 452, 478, 501,
];

const TRADE_GOODS = [
  "luminescent kelp", "deep-coral crystals", "pressure-forged steel",
  "bioluminescent dye", "thermal vent minerals", "abyssal pearls",
  "current-spun silk", "volcanic glass", "reef-stone blocks", "tidal salt",
];

const LOCATIONS = [
  "the Grand Atrium", "the Northern Trench", "the Coral Gardens",
  "the Thermal Vents district", "the Pearl Market", "the Obsidian Spire",
  "the Kelp Forest quarter", "the Abyssal Gate", "the Tidal Chamber",
  "the Reef Wall fortifications",
];

const DISASTER_TYPES = [
  "the Great Storm", "the Black Tide", "the Trench Collapse",
  "the Thermal Surge", "the Coral Blight", "the Pressure Wave",
  "the Deep Quake", "the Current Reversal", "the Ink Cloud Crisis",
  "the Reef Fracture",
];

const TECHNOLOGY_NAMES = [
  "the Pressure Equalizer", "the Bioluminescent Grid", "the Current Harvester",
  "the Deep Forge", "the Coral Growth Accelerator", "the Thermal Tap",
  "the Tidal Generator", "the Abyssal Lens", "the Reef Weaver",
  "the Depth Compass",
];

const CULTURAL_PRACTICES = [
  "the Festival of Tides", "the Deep Communion ritual", "the Coral Planting ceremony",
  "the Annual Current Race", "the Bioluminescent Parade", "the Founding Day recitation",
  "the Elder Council gathering", "the Pearl Exchange tradition", "the Storm Remembrance vigil",
  "the Reef Blessing rites",
];

const AGREEMENTS = [
  "the Coral Trade Agreement", "the Trench Pact", "the Reef Accord",
  "the Tidal Compact", "the Depths Alliance", "the Current Charter",
  "the Pearl Convention", "the Abyssal Treaty", "the Kelp Concordat",
  "the Storm Mutual Aid Pact",
];

// ── Page text templates ──────────────────────────────────────────────

const FOUNDING_TEMPLATES = [
  "In the year {year} of the Deep Calendar, {founder} led a group of settlers to the site that would become {city}.",
  "The waters around {location} were chosen for their natural protection from predators and strong currents.",
  "Initial construction focused on {location}, which served as both a gathering place and a defensive structure.",
  "{founder} established the first governing council, consisting of seven appointed advisors.",
  "The earliest trade connections were formed with surface dwellers who exchanged {good1} for {good2}.",
  "Architectural plans from this period show that {location} was designed to withstand pressure at extreme depths.",
  "Records indicate that {founder} personally oversaw the placement of the first foundation stones at {location}.",
  "The founding charter declared that all citizens would share equally in the harvest of {good1}.",
];

const TRADE_TEMPLATES = [
  "By the year {year}, {city} had established regular trade routes for {good1} and {good2}.",
  "Merchants from {location} organized caravans through the deep currents, carrying {good1} to distant settlements.",
  "The value of {good1} tripled after {founder} negotiated exclusive access to the primary source.",
  "{agreement} was signed in the year {year}, formalizing trade relations between {city} and three neighboring settlements.",
  "Trade disputes over {good2} nearly led to conflict, but {founder} mediated a resolution at {location}.",
  "The {location} became the central marketplace, with stalls dedicated to {good1}, {good2}, and other deep-sea commodities.",
  "Revenue from {good1} exports funded major construction projects throughout {city}.",
  "Foreign traders were granted limited access to {location} under the terms of {agreement}.",
];

const POLITICAL_TEMPLATES = [
  "In the year {year}, {founder} convened an emergency council session at {location} to address growing unrest.",
  "Political power shifted when {founder} proposed expanding the council to include representatives from {location}.",
  "The governance reforms of year {year} established a rotation system for council leadership.",
  "{founder} faced opposition from traditionalists who resisted changes to the founding charter.",
  "The dispute over control of {location} divided the council into two factions for nearly a decade.",
  "By the year {year}, {founder} had consolidated enough support to push through the new administrative code.",
  "Public assemblies at {location} became a regular feature of political life after year {year}.",
  "The council records from this period show that {founder} voted against the majority on the question of {good1} taxation.",
];

const DISASTER_TEMPLATES = [
  "{disaster} struck {city} in the year {year}, causing widespread damage to {location}.",
  "The aftermath of {disaster} required years of reconstruction, particularly at {location}.",
  "{founder} organized the relief effort, directing resources from the {good1} reserves to aid survivors.",
  "Historical accounts disagree on the severity of {disaster}; some claim {location} was completely destroyed.",
  "The engineering response to {disaster} led directly to the development of {technology}.",
  "In the wake of {disaster}, {city} adopted new building codes requiring reinforced structures at {location}.",
  "Trade in {good1} was disrupted for three seasons following {disaster}, causing economic hardship.",
  "Survivors of {disaster} established {practice} as a way to honor those lost in the catastrophe.",
];

const CULTURE_TEMPLATES = [
  "{practice} originated in the year {year} as a celebration of {city}'s founding traditions.",
  "During {practice}, citizens gather at {location} to exchange gifts of {good1}.",
  "{founder} is credited with establishing {practice} after a vision during a deep meditation.",
  "The annual observance of {practice} draws visitors from settlements throughout the region.",
  "Artisans at {location} create ceremonial objects from {good1} specifically for {practice}.",
  "Historical texts describe {practice} as the most important communal event in {city}'s calendar.",
  "Children are taught the significance of {practice} through oral histories passed down by {founder}'s lineage.",
  "The music performed during {practice} at {location} uses instruments crafted from {good2}.",
];

const TECHNOLOGY_TEMPLATES = [
  "{technology} was developed in the year {year} by engineers working at {location}.",
  "The invention of {technology} revolutionized {city}'s ability to harvest {good1}.",
  "{founder} provided funding for {technology} research after recognizing its potential for deep-sea construction.",
  "Early prototypes of {technology} were tested at {location}, with mixed results.",
  "By the year {year}, {technology} had been installed throughout {city}, improving daily life significantly.",
  "The principles behind {technology} were later applied to develop improved methods for processing {good2}.",
  "Foreign delegations visited {location} to study {technology}, leading to {agreement}.",
  "Maintenance of {technology} became a specialized profession, with training centers established at {location}.",
];

const CONFLICT_TEMPLATES = [
  "Tensions over access to {good1} deposits erupted into open conflict in the year {year}.",
  "{founder} commanded the defense of {location} during the siege that lasted forty tides.",
  "The conflict resulted in the destruction of key infrastructure at {location}, including trade warehouses.",
  "Diplomatic efforts by {founder} eventually brought the conflict to an end through {agreement}.",
  "Military strategies developed during this conflict included the use of {technology} for defensive purposes.",
  "The year {year} saw the bloodiest engagement at {location}, where both sides suffered heavy losses.",
  "After the conflict, {city} invested heavily in fortifying {location} to prevent future incursions.",
  "Veterans of the conflict were honored through {practice}, which commemorates their sacrifice annually.",
];

const ALLIANCE_TEMPLATES = [
  "{agreement} was forged in the year {year} between {city} and its former rivals.",
  "{founder} traveled to distant settlements to negotiate the terms of {agreement}.",
  "Under {agreement}, the signatories agreed to share access to {good1} and {good2} resources.",
  "The alliance strengthened {city}'s position and led to joint development projects at {location}.",
  "{agreement} included provisions for mutual defense, which were tested during {disaster}.",
  "Cultural exchanges under {agreement} brought {practice} traditions to {city} for the first time.",
  "The economic benefits of {agreement} were felt most strongly at {location}, where trade volume doubled.",
  "{founder} is remembered as the architect of {agreement}, which endured for over a century.",
];

const RESOURCE_TEMPLATES = [
  "A major deposit of {good1} was discovered near {location} in the year {year}.",
  "The discovery transformed {city}'s economy, attracting settlers and traders from across the deep.",
  "{founder} claimed the discovery site on behalf of the council, preventing private exploitation.",
  "Extraction of {good1} from {location} required the development of {technology}.",
  "By the year {year}, {good1} from this deposit accounted for half of {city}'s total exports.",
  "Disputes over mining rights at {location} led to negotiations that produced {agreement}.",
  "The quality of {good1} from this source was considered superior to all known alternatives.",
  "Environmental concerns about extraction at {location} prompted {founder} to impose harvest limits.",
];

const ARCHITECTURE_TEMPLATES = [
  "Construction of {location} began in the year {year} under the direction of {founder}.",
  "The project required vast quantities of {good1} and {good2}, straining the city's supply chains.",
  "{location} was designed to serve as both a civic center and a refuge during emergencies like {disaster}.",
  "{founder} insisted on incorporating {technology} into the structure's design for improved durability.",
  "Workers from throughout {city} contributed to the construction, which took fifteen seasons to complete.",
  "The completed {location} became a symbol of {city}'s prosperity and engineering prowess.",
  "Architectural innovations developed for {location} were later applied to residential construction.",
  "Visitors described {location} as the most impressive underwater structure they had ever seen.",
];

const TEMPLATE_SETS: Record<string, string[]> = {
  founding: FOUNDING_TEMPLATES,
  trade_route: TRADE_TEMPLATES,
  political_event: POLITICAL_TEMPLATES,
  natural_disaster: DISASTER_TEMPLATES,
  cultural_practice: CULTURE_TEMPLATES,
  technology: TECHNOLOGY_TEMPLATES,
  conflict: CONFLICT_TEMPLATES,
  alliance: ALLIANCE_TEMPLATES,
  resource_discovery: RESOURCE_TEMPLATES,
  architectural_project: ARCHITECTURE_TEMPLATES,
};

const DOC_TITLE_PREFIXES = [
  "Chronicle of", "Records of", "The History of", "Annals of",
  "A Study of", "Memoirs Concerning", "Dispatches from", "Field Notes on",
  "Observations on", "The Official Account of",
];

const AUTHOR_TITLES = [
  "Historian", "Scribe", "Chronicler", "Archivist",
  "Scholar", "Recorder", "Keeper", "Documentarian",
];

const AUTHOR_NAMES = [
  "Finley Deepscrawl", "Maren Tidequill", "Corwin Reefpen", "Shella Inkwell",
  "Dorman Kelptrace", "Tessa Wavemark", "Halsey Coralscript", "Nerida Pearlnote",
  "Basil Trenchwrite", "Ondina Saltpage",
];

// ── Helper: fill template ────────────────────────────────────────────

function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

// ── Data generation ──────────────────────────────────────────────────

export function generateArchiveData(seed: number): ArchiveData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Pick a city name
  const city = pick(CITY_NAMES);

  // Assign a chronological timeline of years
  const years = shuffle(YEARS_POOL).slice(0, 12).sort((a, b) => a - b);

  // Pick founders/characters (need several for cross-document tracking)
  const founders = shuffle(FOUNDER_NAMES).slice(0, 6);

  // Shuffle and assign event types to 10 documents
  const eventTypes = shuffle(EVENT_TYPES);

  // Pick goods, locations, etc.
  const goods = shuffle(TRADE_GOODS);
  const locations = shuffle(LOCATIONS);
  const disasters = shuffle(DISASTER_TYPES);
  const technologies = shuffle(TECHNOLOGY_NAMES);
  const practices = shuffle(CULTURAL_PRACTICES);
  const agreements = shuffle(AGREEMENTS);

  // Build 10 documents
  const documents: Document[] = [];

  // Track key facts for cross-document questions
  const docEvents: Array<{
    docIndex: number;
    eventType: string;
    year: number;
    founder: string;
    location: string;
    disaster: string;
    agreement: string;
    good1: string;
    good2: string;
    technology: string;
    practice: string;
  }> = [];

  for (let d = 0; d < 10; d++) {
    const eventType = eventTypes[d % eventTypes.length];
    const year = years[d % years.length];
    const founder = founders[d % founders.length];
    const location = locations[d % locations.length];
    const disaster = disasters[d % disasters.length];
    const agreement = agreements[d % agreements.length];
    const good1 = goods[d % goods.length];
    const good2 = goods[(d + 3) % goods.length];
    const technology = technologies[d % technologies.length];
    const practice = practices[d % practices.length];

    docEvents.push({
      docIndex: d,
      eventType, year, founder, location,
      disaster, agreement, good1, good2, technology, practice,
    });

    const templates = TEMPLATE_SETS[eventType] || FOUNDING_TEMPLATES;
    const vars: Record<string, string> = {
      city, year: String(year), founder, location,
      disaster, agreement, good1, good2, technology, practice,
    };

    // Generate 6-8 pages of text
    const pageCount = 6 + Math.floor(rng() * 3); // 6, 7, or 8
    const pages: string[] = [];

    // Shuffle templates for variety
    const shuffledTemplates = shuffle(templates);

    for (let p = 0; p < pageCount; p++) {
      // Each page: 4-6 sentences from templates, plus some connecting sentences
      const sentenceCount = 4 + Math.floor(rng() * 3);
      const pageSentences: string[] = [];

      for (let s = 0; s < sentenceCount; s++) {
        const tmplIdx = (p * sentenceCount + s) % shuffledTemplates.length;
        pageSentences.push(fillTemplate(shuffledTemplates[tmplIdx], vars));
      }

      // Add some cross-referencing sentences on certain pages
      if (p >= 2 && d > 0) {
        const refDoc = docEvents[Math.floor(rng() * d)];
        const crossRefs = [
          `This period also saw interactions with ${refDoc.founder}, whose activities are documented elsewhere.`,
          `Related events involving ${refDoc.agreement} are recorded in separate archives.`,
          `The consequences of ${refDoc.disaster} during this era affected many aspects of life in ${city}.`,
          `Trade in ${refDoc.good1} connected these events to broader economic patterns.`,
        ];
        pageSentences.push(pick(crossRefs));
      }

      pages.push(pageSentences.join(" "));
    }

    // Extract keywords from the document
    const keywords = [
      eventType.replace(/_/g, " "),
      founder.split(" ").pop()!.toLowerCase(),
      good1.split(" ").pop()!,
      location.replace("the ", "").split(" ")[0].toLowerCase(),
    ];

    const titlePrefix = pick(DOC_TITLE_PREFIXES);
    const topicLabel = eventType.replace(/_/g, " ");
    const title = `${titlePrefix} ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)} in ${city}`;

    const authorTitle = pick(AUTHOR_TITLES);
    const authorName = pick(AUTHOR_NAMES);

    documents.push({
      id: `doc-${seed}-${d + 1}`,
      title,
      author: `${authorName}, ${authorTitle}`,
      pages,
      keywords,
    });
  }

  // ── Generate 5 cross-document synthesis questions ────────────────

  const questions: ArchiveQuestion[] = [];
  const answers: ArchiveGroundTruth["answers"] = [];

  // Q1: Comparison — compare events across 2+ documents
  const compDocA = docEvents[0];
  const compDocB = docEvents[1];
  const q1Id = `q-${seed}-1`;
  questions.push({
    id: q1Id,
    question: `What was the relationship between ${compDocA.agreement} and ${compDocB.disaster}? How did these events influence each other in ${city}'s history?`,
    type: "comparison",
  });
  answers.push({
    question_id: q1Id,
    answer: `${compDocA.agreement} was signed in the year ${compDocA.year} to formalize trade relations, while ${compDocB.disaster} struck ${city} in the year ${compDocB.year}. ${compDocA.agreement} included provisions that were later tested during ${compDocB.disaster}. The trade disruptions caused by ${compDocB.disaster} affected goods covered under ${compDocA.agreement}, particularly ${compDocA.good1}. ${compDocA.founder} was involved in negotiating ${compDocA.agreement}, and ${compDocB.founder} organized relief efforts after ${compDocB.disaster}.`,
    evidence: [
      { doc_id: documents[0].id, page: 0, excerpt: fillTemplate("{agreement} was signed in the year {year}", { agreement: compDocA.agreement, year: String(compDocA.year) }) },
      { doc_id: documents[0].id, page: 3, excerpt: fillTemplate("Revenue from {good1} exports funded major construction projects", { good1: compDocA.good1 }) },
      { doc_id: documents[1].id, page: 0, excerpt: fillTemplate("{disaster} struck {city} in the year {year}", { disaster: compDocB.disaster, city, year: String(compDocB.year) }) },
      { doc_id: documents[1].id, page: 2, excerpt: fillTemplate("Trade in {good1} was disrupted for three seasons following {disaster}", { good1: compDocB.good1, disaster: compDocB.disaster }) },
    ],
    key_terms: [compDocA.agreement, compDocB.disaster, compDocA.founder, compDocB.founder, compDocA.good1, city],
  });

  // Q2: Timeline ordering
  const sortedEvents = [...docEvents].sort((a, b) => a.year - b.year);
  const q2Id = `q-${seed}-2`;
  const timelineEvents = sortedEvents.slice(0, 6);
  questions.push({
    id: q2Id,
    question: `List the following events in chronological order: ${timelineEvents.map((e) => `the ${e.eventType.replace(/_/g, " ")} (year ${e.year})`).join(", ")}.`,
    type: "timeline",
  });
  answers.push({
    question_id: q2Id,
    answer: timelineEvents.map((e, i) => `${i + 1}. Year ${e.year}: ${e.eventType.replace(/_/g, " ")} — involving ${e.founder} at ${e.location}`).join(". "),
    evidence: timelineEvents.map((e) => ({
      doc_id: documents[e.docIndex].id,
      page: 0,
      excerpt: `Year ${e.year}: ${e.eventType.replace(/_/g, " ")}`,
    })),
    key_terms: timelineEvents.map((e) => `year ${e.year}`),
  });

  // Q3: Cause and effect across documents
  const causeDoc = docEvents[3]; // natural disaster or similar
  const effectDoc = docEvents[4]; // technology or similar
  const q3Id = `q-${seed}-3`;
  questions.push({
    id: q3Id,
    question: `How did the events described in "${documents[3].title}" lead to or influence the developments described in "${documents[4].title}"?`,
    type: "cause_effect",
  });
  answers.push({
    question_id: q3Id,
    answer: `The ${causeDoc.eventType.replace(/_/g, " ")} of year ${causeDoc.year} involving ${causeDoc.founder} at ${causeDoc.location} had direct consequences for later developments. Specifically, the impact on ${causeDoc.good1} resources and infrastructure at ${causeDoc.location} created conditions that necessitated the ${effectDoc.eventType.replace(/_/g, " ")} of year ${effectDoc.year}. ${effectDoc.founder} responded to these challenges by focusing efforts at ${effectDoc.location}, developing ${effectDoc.technology} as a solution. The disruption of ${causeDoc.good1} trade following the earlier events accelerated investment in ${effectDoc.good1}.`,
    evidence: [
      { doc_id: documents[3].id, page: 0, excerpt: `${causeDoc.eventType.replace(/_/g, " ")} in year ${causeDoc.year} at ${causeDoc.location}` },
      { doc_id: documents[3].id, page: 4, excerpt: `Impact on ${causeDoc.good1} resources` },
      { doc_id: documents[4].id, page: 0, excerpt: `${effectDoc.eventType.replace(/_/g, " ")} in year ${effectDoc.year} at ${effectDoc.location}` },
      { doc_id: documents[4].id, page: 2, excerpt: `Development of ${effectDoc.technology}` },
    ],
    key_terms: [causeDoc.eventType.replace(/_/g, " "), effectDoc.eventType.replace(/_/g, " "), causeDoc.founder, effectDoc.founder, causeDoc.good1, effectDoc.technology],
  });

  // Q4: Entity tracking
  // Pick a founder that appears in multiple documents
  const trackedFounder = founders[0];
  const docsWithFounder = docEvents.filter((e) => e.founder === trackedFounder);
  const q4Id = `q-${seed}-4`;
  questions.push({
    id: q4Id,
    question: `Which documents mention ${trackedFounder} and what role did they play in each?`,
    type: "entity_tracking",
  });
  answers.push({
    question_id: q4Id,
    answer: docsWithFounder.map((e) =>
      `In "${documents[e.docIndex].title}" (Document ${e.docIndex + 1}), ${trackedFounder} was involved in the ${e.eventType.replace(/_/g, " ")} of year ${e.year} at ${e.location}. Their role included activities related to ${e.good1} and interactions with ${e.agreement}.`
    ).join(" "),
    evidence: docsWithFounder.map((e) => ({
      doc_id: documents[e.docIndex].id,
      page: 0,
      excerpt: `${trackedFounder} in ${e.eventType.replace(/_/g, " ")} year ${e.year}`,
    })),
    key_terms: [trackedFounder, ...docsWithFounder.map((e) => e.eventType.replace(/_/g, " "))],
  });

  // Q5: Contradiction detection
  // Plant a deliberate contradiction between two documents about a disaster's impact
  const contradictDocA = docEvents[2];
  const contradictDocB = docEvents[6 < docEvents.length ? 6 : docEvents.length - 1];
  const sharedDisaster = contradictDocA.disaster;
  const q5Id = `q-${seed}-5`;
  questions.push({
    id: q5Id,
    question: `"${documents[2].title}" and "${documents[contradictDocB.docIndex].title}" both reference ${sharedDisaster}. Do their accounts agree? What are the specific claims made by each document?`,
    type: "contradiction",
  });
  answers.push({
    question_id: q5Id,
    answer: `"${documents[2].title}" describes ${sharedDisaster} in the context of the ${contradictDocA.eventType.replace(/_/g, " ")} of year ${contradictDocA.year}, claiming it affected ${contradictDocA.location} and disrupted ${contradictDocA.good1} trade. "${documents[contradictDocB.docIndex].title}" references ${sharedDisaster} in relation to the ${contradictDocB.eventType.replace(/_/g, " ")} of year ${contradictDocB.year}, attributing its impact to ${contradictDocB.location} and the disruption of ${contradictDocB.good1}. The documents disagree on the primary location affected: ${contradictDocA.location} versus ${contradictDocB.location}. They also differ on the economic impact, citing different goods (${contradictDocA.good1} vs ${contradictDocB.good1}).`,
    evidence: [
      { doc_id: documents[2].id, page: 0, excerpt: `${sharedDisaster} affected ${contradictDocA.location}` },
      { doc_id: documents[2].id, page: 2, excerpt: `Disruption of ${contradictDocA.good1} trade` },
      { doc_id: documents[contradictDocB.docIndex].id, page: 0, excerpt: `${sharedDisaster} affected ${contradictDocB.location}` },
      { doc_id: documents[contradictDocB.docIndex].id, page: 3, excerpt: `Disruption of ${contradictDocB.good1} trade` },
    ],
    key_terms: [sharedDisaster, contradictDocA.location, contradictDocB.location, contradictDocA.good1, contradictDocB.good1],
  });

  const objective =
    `You are an archival researcher investigating the underwater city of ${city}. ` +
    `A corpus of 10 historical documents is available through a paginated API. ` +
    `Each document has multiple pages of text. You can browse document metadata, ` +
    `read individual pages, and search by keyword. ` +
    `Answer 5 cross-document synthesis questions that require combining information from multiple sources. ` +
    `For each answer, cite your evidence with document IDs and page numbers.`;

  return {
    documents,
    questions,
    groundTruth: { answers },
    objective,
  };
}
