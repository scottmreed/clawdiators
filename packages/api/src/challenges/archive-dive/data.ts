import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ───────────────────────────────────────────────────────

export interface Document {
  id: string;
  title: string;
  author: string;
  sourceType: "primary" | "secondary";
  pages: string[];
  keywords: string[];
}

export interface ArchiveQuestion {
  id: string;
  question: string;
  type: string;
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

// ── Pools ────────────────────────────────────────────────────────────

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

// Alternate names for events — used for cross-referencing questions
const DISASTER_ALIASES: Record<string, string> = {
  "the Great Storm": "the Catastrophe of the Western Currents",
  "the Black Tide": "the Dark Waters Incident",
  "the Trench Collapse": "the Subsidence Event",
  "the Thermal Surge": "the Vent Eruption of the Lower Depths",
  "the Coral Blight": "the Reef Wasting Disease",
  "the Pressure Wave": "the Shockwave Incident",
  "the Deep Quake": "the Tectonic Upheaval",
  "the Current Reversal": "the Great Flow Inversion",
  "the Ink Cloud Crisis": "the Obscuring Event",
  "the Reef Fracture": "the Structural Failure of the Outer Wall",
};

const AGREEMENT_ALIASES: Record<string, string> = {
  "the Coral Trade Agreement": "the First Mercantile Compact",
  "the Trench Pact": "the Deep Border Accord",
  "the Reef Accord": "the Outer Barrier Settlement",
  "the Tidal Compact": "the Waters Partition Treaty",
  "the Depths Alliance": "the Lower Strata Coalition",
  "the Current Charter": "the Flow Rights Concordat",
  "the Pearl Convention": "the Gemstone Exchange Protocol",
  "the Abyssal Treaty": "the Abyss Non-Aggression Pact",
  "the Kelp Concordat": "the Forest Floor Agreement",
  "the Storm Mutual Aid Pact": "the Emergency Cooperation Accord",
};

// ── Narrative styles ─────────────────────────────────────────────────

type NarrativeStyle = "chronicle" | "journal" | "report" | "scholarly" | "testimony";

const NARRATIVE_STYLES: NarrativeStyle[] = ["chronicle", "journal", "report", "scholarly", "testimony"];

function styleSourceType(style: NarrativeStyle): "primary" | "secondary" {
  return (style === "journal" || style === "report" || style === "testimony") ? "primary" : "secondary";
}

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

// ── Narrative wrappers ───────────────────────────────────────────────
// These add style-specific framing to template-generated content.

const CHRONICLE_FRAMES = [
  "Chapter {chapterNum}. The events herein recounted transpired in the year {year} of the Deep Calendar, as preserved in the municipal archives of {city}.",
  "Continuing the annals of {city}, we now turn to the period surrounding the year {year}, a time of considerable significance.",
  "The following account has been compiled from multiple sources and cross-referenced with official records where possible.",
];

const JOURNAL_FRAMES = [
  "Entry dated the fourteenth tide of year {year}. The currents were restless today, and so was the council.",
  "I write this by the dim glow of bioluminescent moss, unable to sleep after what I witnessed at {location}.",
  "Another sleepless night. The events of recent days weigh heavily. I must record them before memory fades.",
  "Personal log — I hesitate to commit this to writing, but someone must preserve the truth of what happened.",
];

const REPORT_FRAMES = [
  "OFFICE OF THE HIGH COUNCIL — INTERNAL REPORT\nSubject: {eventLabel}\nClassification: Council Eyes Only\nFiling Year: {year}",
  "MEMORANDUM\nTo: Council of Elders\nFrom: {author}\nRe: Situation Assessment — Year {year}\n\nExecutive Summary:",
  "FIELD REPORT — PRIORITY DISPATCH\nOriginating Station: {location}\nReporting Period: Year {year}\n\nFindings:",
];

const SCHOLARLY_FRAMES = [
  "Abstract: This study re-examines the {eventLabel} of year {year} in light of recently uncovered primary source material from the {city} archives.",
  "In the body of literature concerning {city}'s history, the {eventLabel} of the {year} period has generated significant scholarly debate.",
  "Previous analyses of this period have relied heavily on the official chronicles. However, cross-referencing with trade ledgers and private correspondence reveals a more complex picture.",
];

const TESTIMONY_FRAMES = [
  "[Transcribed oral testimony of {witness}, recorded before the Council of Remembrance]\n\nQ: Please tell us, in your own words, what you recall.",
  "[Deposition of {witness}, given under oath at {location}]\n\nWitness: I swear by the deep currents that what I say is true.",
  "[Interview transcript — {witness}, survivor and eyewitness]\n\nInterviewer: Take your time. Start from the beginning.",
];

const STYLE_FRAMES: Record<NarrativeStyle, string[]> = {
  chronicle: CHRONICLE_FRAMES,
  journal: JOURNAL_FRAMES,
  report: REPORT_FRAMES,
  scholarly: SCHOLARLY_FRAMES,
  testimony: TESTIMONY_FRAMES,
};

// Testimony-style sentence transforms: first-person, colloquial
const TESTIMONY_CONNECTORS = [
  "I remember it clearly — ",
  "What people don't understand is that ",
  "Now, I was standing right there when ",
  "The official story says one thing, but I saw with my own eyes that ",
  "They'll tell you it was simple, but let me explain — ",
  "I'll never forget the moment when ",
];

// Journal-style sentence transforms: personal, reflective
const JOURNAL_CONNECTORS = [
  "I cannot overstate how ",
  "What struck me most was that ",
  "Looking back now, it seems inevitable that ",
  "At the time, none of us realized that ",
  "My own role in these events was modest, but I observed firsthand that ",
];

// Scholarly-style connectors: analytical, comparative
const SCHOLARLY_CONNECTORS = [
  "The evidence suggests that ",
  "Contrary to the prevailing narrative, ",
  "A careful reading of the primary sources indicates that ",
  "When compared with contemporary accounts, it becomes clear that ",
  "The scholarly consensus has shifted regarding ",
];

const DOC_TITLE_PREFIXES = [
  "Chronicle of", "Records of", "The History of", "Annals of",
  "A Study of", "Memoirs Concerning", "Dispatches from", "Field Notes on",
  "Observations on", "The Official Account of",
];

const JOURNAL_TITLE_PREFIXES = [
  "Personal Journal:", "Private Diary:", "Field Notes:",
  "Expedition Log:", "Daily Record:",
];

const REPORT_TITLE_PREFIXES = [
  "Official Report on", "Council Memorandum:", "Classified Assessment of",
  "Field Dispatch:", "Administrative Record:",
];

const SCHOLARLY_TITLE_PREFIXES = [
  "A Re-examination of", "Revisiting the", "New Perspectives on",
  "A Critical Analysis of", "Reconsidering the",
];

const TESTIMONY_TITLE_PREFIXES = [
  "Testimony Regarding", "Oral Account of", "Witness Statement:",
  "Deposition Concerning", "Recorded Recollection of",
];

const AUTHOR_TITLES = [
  "Historian", "Scribe", "Chronicler", "Archivist",
  "Scholar", "Recorder", "Keeper", "Documentarian",
];

const AUTHOR_NAMES = [
  "Finley Deepscrawl", "Maren Tidequill", "Corwin Reefpen", "Shella Inkwell",
  "Dorman Kelptrace", "Tessa Wavemark", "Halsey Coralscript", "Nerida Pearlnote",
  "Basil Trenchwrite", "Ondina Saltpage", "Gideon Coralscribe", "Lysara Deepwell",
  "Morvyn Inkflow", "Calder Tidalpen", "Pelagia Reefnote", "Heron Wavewriter",
];

const WITNESS_NAMES = [
  "Old Barnacle Pete", "Kelpmender Ysara", "Trader Finn of the Vents",
  "Retired Captain Aldris", "Midwife Coral", "Engineer First-Class Devrin",
  "Night-Watch Keeper Selma", "Dockhand Orro",
];

// ── Helpers ──────────────────────────────────────────────────────────

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

// ── Data generation ──────────────────────────────────────────────────

interface DocEvent {
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
  style: NarrativeStyle;
}

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

  const city = pick(CITY_NAMES);
  const years = shuffle(YEARS_POOL).slice(0, 16).sort((a, b) => a - b);
  const founders = shuffle(FOUNDER_NAMES).slice(0, 8);
  const eventTypes = shuffle(EVENT_TYPES);
  const goods = shuffle(TRADE_GOODS);
  const locations = shuffle(LOCATIONS);
  const disasters = shuffle(DISASTER_TYPES);
  const technologies = shuffle(TECHNOLOGY_NAMES);
  const practices = shuffle(CULTURAL_PRACTICES);
  const agreements = shuffle(AGREEMENTS);

  const DOC_COUNT = 16;
  const documents: Document[] = [];
  const docEvents: DocEvent[] = [];

  // ── Assign contradiction pairs ─────────────────────────────────
  // Pair A: docs 2 & 10 — same disaster, disagree on year and location
  // Pair B: docs 4 & 12 — same agreement, disagree on who negotiated it
  const contradictionPairA = { docA: 2, docB: 10, sharedDisaster: disasters[0] };
  const contradictionPairB = { docA: 4, docB: 12, sharedAgreement: agreements[0] };

  // ── Assign cross-reference pair ────────────────────────────────
  // Docs 3 & 8 reference the same event under different names
  const crossRefDisaster = disasters[1];
  const crossRefAlias = DISASTER_ALIASES[crossRefDisaster] || `the Crisis of Year ${years[3]}`;

  for (let d = 0; d < DOC_COUNT; d++) {
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
    const style = NARRATIVE_STYLES[d % NARRATIVE_STYLES.length];

    docEvents.push({
      docIndex: d, eventType, year, founder, location,
      disaster, agreement, good1, good2, technology, practice, style,
    });

    const templates = TEMPLATE_SETS[eventType] || FOUNDING_TEMPLATES;
    const vars: Record<string, string> = {
      city, year: String(year), founder, location,
      disaster, agreement, good1, good2, technology, practice,
    };

    const pageCount = 6 + Math.floor(rng() * 3);
    const pages: string[] = [];
    const shuffledTemplates = shuffle(templates);

    // Build the style-specific frame for page 0
    const frameVars: Record<string, string> = {
      ...vars,
      chapterNum: String(d + 1),
      eventLabel: eventType.replace(/_/g, " "),
      author: pick(AUTHOR_NAMES),
      witness: pick(WITNESS_NAMES),
    };
    const styleFrame = fillTemplate(pick(STYLE_FRAMES[style]), frameVars);

    for (let p = 0; p < pageCount; p++) {
      const sentenceCount = 4 + Math.floor(rng() * 3);
      const pageSentences: string[] = [];

      if (p === 0) {
        pageSentences.push(styleFrame);
      }

      for (let s = 0; s < sentenceCount; s++) {
        const tmplIdx = (p * sentenceCount + s) % shuffledTemplates.length;
        let sentence = fillTemplate(shuffledTemplates[tmplIdx], vars);

        // Apply style-specific voice transforms on some sentences
        if (style === "testimony" && rng() > 0.6) {
          sentence = pick(TESTIMONY_CONNECTORS) + sentence.charAt(0).toLowerCase() + sentence.slice(1);
        } else if (style === "journal" && rng() > 0.6) {
          sentence = pick(JOURNAL_CONNECTORS) + sentence.charAt(0).toLowerCase() + sentence.slice(1);
        } else if (style === "scholarly" && rng() > 0.6) {
          sentence = pick(SCHOLARLY_CONNECTORS) + sentence.charAt(0).toLowerCase() + sentence.slice(1);
        }

        pageSentences.push(sentence);
      }

      // Cross-document references on later pages
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

      // Contradiction pair A: doc 10 uses different year and location for same disaster
      if (d === contradictionPairA.docB && p === 1) {
        const altYear = years[(contradictionPairA.docA + 7) % years.length];
        const altLocation = locations[(contradictionPairA.docA + 5) % locations.length];
        pageSentences.push(
          `According to this account, ${contradictionPairA.sharedDisaster} struck in the year ${altYear}, devastating ${altLocation}. ` +
          `The toll was catastrophic — nearly the entire quarter had to be rebuilt from the foundation stones upward.`
        );
      }

      // Contradiction pair B: doc 12 credits a different founder for the same agreement
      if (d === contradictionPairB.docB && p === 1) {
        const altFounder = founders[(contradictionPairB.docA + 4) % founders.length];
        pageSentences.push(
          `It was ${altFounder} — not the figure commonly credited — who truly brokered ${contradictionPairB.sharedAgreement}. ` +
          `The popular attribution is a later embellishment, as surviving correspondence makes clear.`
        );
      }

      // Cross-reference: doc 8 uses an alias for the same disaster described in doc 3
      if (d === 8 && p === 2) {
        pageSentences.push(
          `The period was also marked by ${crossRefAlias}, an event of devastating proportions ` +
          `that disrupted trade routes and displaced hundreds of families from their quarters.`
        );
      }

      pages.push(pageSentences.join(" "));
    }

    const keywords = [
      eventType.replace(/_/g, " "),
      founder.split(" ").pop()!.toLowerCase(),
      good1.split(" ").pop()!,
      location.replace("the ", "").split(" ")[0].toLowerCase(),
    ];

    // Style-specific titles
    let titlePrefix: string;
    if (style === "journal") titlePrefix = pick(JOURNAL_TITLE_PREFIXES);
    else if (style === "report") titlePrefix = pick(REPORT_TITLE_PREFIXES);
    else if (style === "scholarly") titlePrefix = pick(SCHOLARLY_TITLE_PREFIXES);
    else if (style === "testimony") titlePrefix = pick(TESTIMONY_TITLE_PREFIXES);
    else titlePrefix = pick(DOC_TITLE_PREFIXES);

    const topicLabel = eventType.replace(/_/g, " ");
    const title = `${titlePrefix} ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)} in ${city}`;

    const authorTitle = pick(AUTHOR_TITLES);
    const authorName = pick(AUTHOR_NAMES);

    documents.push({
      id: `doc-${seed}-${d + 1}`,
      title,
      author: `${authorName}, ${authorTitle}`,
      sourceType: styleSourceType(style),
      pages,
      keywords,
    });
  }

  // ── Generate 10 cross-document synthesis questions ─────────────

  const questions: ArchiveQuestion[] = [];
  const answers: ArchiveGroundTruth["answers"] = [];

  // Q1: Comparison — compare events across 2 documents
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
  const causeDoc = docEvents[3];
  const effectDoc = docEvents[4];
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

  // Q5: Contradiction detection — pair A (year/location disagreement)
  const cDocA = docEvents[contradictionPairA.docA];
  const cDocB = docEvents[contradictionPairA.docB];
  const altYearB = years[(contradictionPairA.docA + 7) % years.length];
  const altLocationB = locations[(contradictionPairA.docA + 5) % locations.length];
  const q5Id = `q-${seed}-5`;
  questions.push({
    id: q5Id,
    question: `"${documents[contradictionPairA.docA].title}" and "${documents[contradictionPairA.docB].title}" both reference ${contradictionPairA.sharedDisaster}. Do their accounts agree? Identify specific contradictions.`,
    type: "contradiction",
  });
  answers.push({
    question_id: q5Id,
    answer: `The two documents contradict each other on both the date and the primary location affected. "${documents[contradictionPairA.docA].title}" places ${contradictionPairA.sharedDisaster} in the year ${cDocA.year} and describes damage to ${cDocA.location}. "${documents[contradictionPairA.docB].title}" instead dates the event to year ${altYearB} and claims ${altLocationB} was devastated. The year discrepancy (${cDocA.year} vs ${altYearB}) and location discrepancy (${cDocA.location} vs ${altLocationB}) suggest either different phases of the same event or a genuine error in one of the sources.`,
    evidence: [
      { doc_id: documents[contradictionPairA.docA].id, page: 0, excerpt: `${contradictionPairA.sharedDisaster} in year ${cDocA.year} at ${cDocA.location}` },
      { doc_id: documents[contradictionPairA.docB].id, page: 1, excerpt: `${contradictionPairA.sharedDisaster} struck in the year ${altYearB}, devastating ${altLocationB}` },
    ],
    key_terms: [contradictionPairA.sharedDisaster, String(cDocA.year), String(altYearB), cDocA.location, altLocationB],
  });

  // Q6: Cross-referencing with non-obvious connection (alternate names)
  const q6Id = `q-${seed}-6`;
  const crossRefDocA = docEvents[3];
  const crossRefDocB = docEvents[8];
  questions.push({
    id: q6Id,
    question: `Document "${documents[3].title}" describes ${crossRefDisaster}. Is the same event mentioned in any other document under a different name? If so, which document and what name is used?`,
    type: "cross_reference",
  });
  answers.push({
    question_id: q6Id,
    answer: `Yes. "${documents[8].title}" (Document 9) refers to the same event as "${crossRefAlias}." Both accounts describe an event of devastating proportions that disrupted trade routes and displaced families. The alternate naming in Document 9 — ${crossRefAlias} — obscures the connection, but the described consequences (trade disruption, displacement) and approximate timing align with ${crossRefDisaster} as described in Document 4. ${crossRefDocA.founder} is connected to events in Document 4, while Document 9 covers ${crossRefDocB.eventType.replace(/_/g, " ")} but references the same disaster under its alternate name.`,
    evidence: [
      { doc_id: documents[3].id, page: 0, excerpt: `${crossRefDisaster} in the context of ${crossRefDocA.eventType.replace(/_/g, " ")}` },
      { doc_id: documents[8].id, page: 2, excerpt: `${crossRefAlias}, an event of devastating proportions that disrupted trade routes` },
    ],
    key_terms: [crossRefDisaster, crossRefAlias, documents[3].title, documents[8].title],
  });

  // Q7: Primary vs secondary source distinction
  const q7Id = `q-${seed}-7`;
  const primaryDocs = docEvents.filter((e) => styleSourceType(e.style) === "primary");
  const secondaryDocs = docEvents.filter((e) => styleSourceType(e.style) === "secondary");
  const primaryDocList = primaryDocs.slice(0, 4).map((e) => `"${documents[e.docIndex].title}" (Document ${e.docIndex + 1})`);
  const secondaryDocList = secondaryDocs.slice(0, 4).map((e) => `"${documents[e.docIndex].title}" (Document ${e.docIndex + 1})`);
  questions.push({
    id: q7Id,
    question: `Which documents in the archive are primary sources (first-hand accounts, official records, eyewitness testimony) and which are secondary sources (later analyses, compilations, scholarly interpretations)? For each, explain what textual evidence indicates its source type.`,
    type: "source_classification",
  });
  answers.push({
    question_id: q7Id,
    answer: `Primary sources include ${primaryDocList.join(", ")}. These contain first-person accounts, official memoranda, field reports, or sworn testimony — markers of direct observation. Secondary sources include ${secondaryDocList.join(", ")}. These are characterized by third-person retrospective analysis, compilation from multiple earlier sources, scholarly framing with abstracts, or chapter-based chronicle structure typical of later historiography. The distinction matters because primary sources reflect the biases and limited perspective of participants, while secondary sources may introduce interpretive errors but offer broader synthesis.`,
    evidence: [
      ...primaryDocs.slice(0, 2).map((e) => ({
        doc_id: documents[e.docIndex].id,
        page: 0,
        excerpt: `${e.style} style — first-person or official framing`,
      })),
      ...secondaryDocs.slice(0, 2).map((e) => ({
        doc_id: documents[e.docIndex].id,
        page: 0,
        excerpt: `${e.style} style — retrospective analytical framing`,
      })),
    ],
    key_terms: ["primary source", "secondary source", "first-hand", "eyewitness", "scholarly analysis", "chronicle"],
  });

  // Q8: Contradiction detection — pair B (attribution disagreement)
  const cDocC = docEvents[contradictionPairB.docA];
  const cDocD = docEvents[contradictionPairB.docB];
  const altFounderD = founders[(contradictionPairB.docA + 4) % founders.length];
  const q8Id = `q-${seed}-8`;
  questions.push({
    id: q8Id,
    question: `Who does "${documents[contradictionPairB.docA].title}" credit with brokering ${contradictionPairB.sharedAgreement}? Does "${documents[contradictionPairB.docB].title}" agree? How might you reconcile the two accounts?`,
    type: "contradiction",
  });
  answers.push({
    question_id: q8Id,
    answer: `"${documents[contradictionPairB.docA].title}" credits ${cDocC.founder} with brokering ${contradictionPairB.sharedAgreement}. However, "${documents[contradictionPairB.docB].title}" explicitly disputes this, naming ${altFounderD} as the true architect and calling the popular attribution a "later embellishment." The contradiction might be reconciled if both figures played roles at different stages — ${cDocC.founder} in the public-facing negotiations and ${altFounderD} in the behind-the-scenes diplomacy — or if one account reflects political bias. The secondary-source document may have adopted the more politically convenient narrative.`,
    evidence: [
      { doc_id: documents[contradictionPairB.docA].id, page: 0, excerpt: `${cDocC.founder} negotiated ${contradictionPairB.sharedAgreement}` },
      { doc_id: documents[contradictionPairB.docB].id, page: 1, excerpt: `It was ${altFounderD} who truly brokered ${contradictionPairB.sharedAgreement}` },
    ],
    key_terms: [contradictionPairB.sharedAgreement, cDocC.founder, altFounderD, "attribution", "embellishment"],
  });

  // Q9: Multi-document synthesis — economic impact chain
  const econDocs = [docEvents[0], docEvents[5], docEvents[9]];
  const q9Id = `q-${seed}-9`;
  questions.push({
    id: q9Id,
    question: `Trace the economic history of ${econDocs[0].good1} across the archive. Which documents discuss its trade, discovery, or disruption? Construct a timeline of how this commodity's importance changed over time.`,
    type: "synthesis",
  });
  answers.push({
    question_id: q9Id,
    answer: `${econDocs[0].good1} appears across multiple documents. In "${documents[econDocs[0].docIndex].title}" (year ${econDocs[0].year}), it is mentioned in the context of ${econDocs[0].eventType.replace(/_/g, " ")} at ${econDocs[0].location}. "${documents[econDocs[1].docIndex].title}" (year ${econDocs[1].year}) references it during the ${econDocs[1].eventType.replace(/_/g, " ")} at ${econDocs[1].location}, indicating its continued economic significance. "${documents[econDocs[2].docIndex].title}" (year ${econDocs[2].year}) provides additional context through the ${econDocs[2].eventType.replace(/_/g, " ")}. The commodity's trajectory shows it moving from an initial trade good to a strategic resource whose control shaped political alliances and conflict.`,
    evidence: econDocs.map((e) => ({
      doc_id: documents[e.docIndex].id,
      page: 0,
      excerpt: `${e.good1} in the context of ${e.eventType.replace(/_/g, " ")} year ${e.year}`,
    })),
    key_terms: [econDocs[0].good1, ...econDocs.map((e) => `year ${e.year}`), ...econDocs.map((e) => e.eventType.replace(/_/g, " "))],
  });

  // Q10: Reliability assessment — comparing source types on the same topic
  const reliabilityDocPrimary = docEvents.find((e) => styleSourceType(e.style) === "primary")!;
  const reliabilityDocSecondary = docEvents.find((e) => styleSourceType(e.style) === "secondary" && e.docIndex !== 0)!;
  const q10Id = `q-${seed}-10`;
  questions.push({
    id: q10Id,
    question: `Compare the account in "${documents[reliabilityDocPrimary.docIndex].title}" (a ${reliabilityDocPrimary.style === "journal" ? "personal journal" : reliabilityDocPrimary.style === "report" ? "official report" : "testimony"}) with "${documents[reliabilityDocSecondary.docIndex].title}" (a ${reliabilityDocSecondary.style === "chronicle" ? "later chronicle" : "scholarly analysis"}). Which is likely more reliable for establishing specific dates and names? Which provides better context for understanding motivations? Justify your reasoning.`,
    type: "source_evaluation",
  });
  answers.push({
    question_id: q10Id,
    answer: `"${documents[reliabilityDocPrimary.docIndex].title}" is a ${reliabilityDocPrimary.style} — a primary source from year ${reliabilityDocPrimary.year} covering the ${reliabilityDocPrimary.eventType.replace(/_/g, " ")} at ${reliabilityDocPrimary.location}. As a first-hand account, it is more reliable for specific details like dates, names, and immediate circumstances, though it carries the biases of its author's perspective. "${documents[reliabilityDocSecondary.docIndex].title}" is a ${reliabilityDocSecondary.style} — a secondary source that synthesizes information about the ${reliabilityDocSecondary.eventType.replace(/_/g, " ")} of year ${reliabilityDocSecondary.year}. It provides better context for motivations and broader historical patterns because the author had access to multiple accounts and the benefit of hindsight. However, it may introduce interpretive errors or reflect the biases of a later era.`,
    evidence: [
      { doc_id: documents[reliabilityDocPrimary.docIndex].id, page: 0, excerpt: `${reliabilityDocPrimary.style} — first-hand account of year ${reliabilityDocPrimary.year}` },
      { doc_id: documents[reliabilityDocSecondary.docIndex].id, page: 0, excerpt: `${reliabilityDocSecondary.style} — retrospective analysis of year ${reliabilityDocSecondary.year}` },
    ],
    key_terms: [
      "primary source", "secondary source", "reliability", reliabilityDocPrimary.style,
      reliabilityDocSecondary.style, reliabilityDocPrimary.founder, reliabilityDocSecondary.founder,
    ],
  });

  const objective =
    `You are an archival researcher investigating the underwater city of ${city}. ` +
    `A corpus of ${DOC_COUNT} historical documents is available through a paginated API. ` +
    `The documents span multiple narrative styles — formal chronicles, personal journals, ` +
    `official reports, scholarly analyses, and oral testimonies — and represent both primary ` +
    `and secondary sources. Some documents contain partially contradictory accounts of the same events, ` +
    `and some events are referenced under different names across documents. ` +
    `Each document has multiple pages of text. You can browse document metadata, ` +
    `read individual pages, and search by keyword. ` +
    `Answer 10 cross-document synthesis questions that require combining information from multiple sources, ` +
    `detecting contradictions, distinguishing primary from secondary sources, and tracing cross-references. ` +
    `Submit flat keys by question ID, for example: { "${q1Id}": "...", "${q1Id}_evidence": [{ "doc_id": "${documents[0].id}", "page": 0 }] }. ` +
    `For each answer, cite your evidence with document IDs and page numbers.`;

  return {
    documents,
    questions,
    groundTruth: { answers },
    objective,
  };
}
