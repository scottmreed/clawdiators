import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ───────────────────────────────────────────────────────

export interface Citizen {
  id: string;
  name: string;
  age: number;
  occupation: string;
  district: string;
}

export interface PropertyRecord {
  id: string;
  citizen_id: string;
  address: string;
  property_type: string;
  assessed_value: number;
}

export interface VehicleRecord {
  id: string;
  citizen_id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
}

export interface ReconGroundTruth {
  targets: Array<{
    citizen_id: string;
    name: string;
    properties: PropertyRecord[];
    vehicles: VehicleRecord[];
    total_property_value: number;
    vehicle_count: number;
  }>;
  rate_limits: { citizens: number; properties: number; vehicles: number };
}

export interface ReconData {
  citizens: Citizen[];
  properties: PropertyRecord[];
  vehicles: VehicleRecord[];
  targets: string[]; // target citizen IDs
  groundTruth: ReconGroundTruth;
  objective: string;
}

// ── Seed data pools ──────────────────────────────────────────────────

const FIRST_NAMES = [
  "Ada", "Bjorn", "Cleo", "Dante", "Elena", "Felix", "Greta", "Hugo",
  "Iris", "Jasper", "Kira", "Liam", "Mina", "Niko", "Opal", "Pavel",
  "Quinn", "Rosa", "Sven", "Tara", "Ulric", "Vera", "Wyatt", "Xena",
];

const LAST_NAMES = [
  "Ashford", "Bloom", "Crane", "Dune", "Everett", "Frost", "Gale",
  "Harrow", "Inkwell", "Jarvis", "Kelp", "Loom", "Marsh", "Norwood",
  "Onyx", "Pike", "Quill", "Reef", "Stone", "Thorn", "Voss", "Wren",
];

const OCCUPATIONS = [
  "marine biologist", "dock supervisor", "coral architect", "tide engineer",
  "fish merchant", "lighthouse keeper", "cartographer", "net weaver",
  "harbor pilot", "kelp farmer", "pearl diver", "shipwright",
  "weather reader", "salt trader", "wave forecaster", "reef inspector",
];

const DISTRICTS = [
  "Coral Quarter", "Harborside", "Tide Flats", "Deep Ward",
  "Reef Row", "Lantern District", "Salt Basin", "Driftwood Heights",
];

const STREET_NAMES = [
  "Anchor Lane", "Breakwater Rd", "Current St", "Dockside Ave",
  "Eel Alley", "Flotsam Way", "Gull Terrace", "Helm Crescent",
  "Inlet Blvd", "Jetty Close", "Keel Row", "Lagoon Path",
];

const PROPERTY_TYPES = [
  "residential", "commercial", "warehouse", "workshop", "mixed-use",
];

const VEHICLE_MAKES = [
  "Tidecraft", "Reefrunner", "CoralMotor", "DeepDrive", "SaltWind",
];

const VEHICLE_MODELS = [
  "Mariner", "Drifter", "Navigator", "Cruiser", "Hauler",
  "Scout", "Ranger", "Clipper", "Sprinter", "Voyager",
];

// ── Generator ────────────────────────────────────────────────────────

export function generateReconData(seed: number): ReconData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  // Shuffle helper
  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Generate a unique plate string
  const generatePlate = (): string => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const l1 = letters[Math.floor(rng() * 26)];
    const l2 = letters[Math.floor(rng() * 26)];
    const l3 = letters[Math.floor(rng() * 26)];
    const num = String(randInt(100, 999));
    return `${l1}${l2}${l3}-${num}`;
  };

  // ── Generate 20 citizens ──────────────────────────────────────────
  const shuffledFirst = shuffle(FIRST_NAMES);
  const shuffledLast = shuffle(LAST_NAMES);
  const citizens: Citizen[] = [];
  for (let i = 0; i < 20; i++) {
    citizens.push({
      id: `cit-${seed}-${i}`,
      name: `${shuffledFirst[i % shuffledFirst.length]} ${shuffledLast[i % shuffledLast.length]}`,
      age: randInt(22, 68),
      occupation: pick(OCCUPATIONS),
      district: pick(DISTRICTS),
    });
  }

  // ── Generate property records (1-3 per citizen, some have none) ───
  const properties: PropertyRecord[] = [];
  let propIdx = 0;
  for (const citizen of citizens) {
    const count = randInt(0, 3); // 0-3 properties
    for (let p = 0; p < count; p++) {
      const streetNum = randInt(1, 200);
      properties.push({
        id: `prop-${seed}-${propIdx}`,
        citizen_id: citizen.id,
        address: `${streetNum} ${pick(STREET_NAMES)}, ${citizen.district}`,
        property_type: pick(PROPERTY_TYPES),
        assessed_value: randInt(50, 500) * 1000,
      });
      propIdx++;
    }
  }

  // ── Generate vehicle records (0-2 per citizen) ────────────────────
  const vehicles: VehicleRecord[] = [];
  let vehIdx = 0;
  for (const citizen of citizens) {
    const count = randInt(0, 2);
    for (let v = 0; v < count; v++) {
      vehicles.push({
        id: `veh-${seed}-${vehIdx}`,
        citizen_id: citizen.id,
        make: pick(VEHICLE_MAKES),
        model: pick(VEHICLE_MODELS),
        year: randInt(2015, 2025),
        plate: generatePlate(),
      });
      vehIdx++;
    }
  }

  // ── Pick 3 target citizens ────────────────────────────────────────
  const shuffledCitizens = shuffle(citizens);
  const targetCitizens = shuffledCitizens.slice(0, 3);
  const targetIds = targetCitizens.map((c) => c.id);

  // ── Build ground truth ────────────────────────────────────────────
  const rateLimits = { citizens: 5, properties: 3, vehicles: 4 };

  const targets = targetCitizens.map((citizen) => {
    const citizenProps = properties.filter((p) => p.citizen_id === citizen.id);
    const citizenVehs = vehicles.filter((v) => v.citizen_id === citizen.id);
    return {
      citizen_id: citizen.id,
      name: citizen.name,
      properties: citizenProps,
      vehicles: citizenVehs,
      total_property_value: citizenProps.reduce((sum, p) => sum + p.assessed_value, 0),
      vehicle_count: citizenVehs.length,
    };
  });

  const groundTruth: ReconGroundTruth = { targets, rate_limits: rateLimits };

  const objective =
    `Gather complete dossiers on 3 target citizens from the municipal database. ` +
    `For each target, collect: personal info, all property records (with total assessed value), ` +
    `and all vehicle records. ` +
    `RATE LIMITS: citizens API allows ${rateLimits.citizens} calls/min, ` +
    `properties API allows ${rateLimits.properties} calls/min, ` +
    `vehicles API allows ${rateLimits.vehicles} calls/min. ` +
    `Plan your queries carefully to avoid 429 errors. ` +
    `Submit a JSON object with key "dossiers" containing an array of 3 objects, ` +
    `each with: citizen_id, name, properties (array), vehicles (array), ` +
    `total_property_value (number), and vehicle_count (number).`;

  return {
    citizens,
    properties,
    vehicles,
    targets: targetIds,
    groundTruth,
    objective,
  };
}
