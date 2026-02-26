import { mulberry32 } from "../../services/whimsy.js";

/**
 * Coral Census: 5-batch population tracking across 6 regions.
 * 100 population events split into 5 batches of 20.
 * Each batch is gated behind a checkpoint confirming running totals.
 */

export interface Region {
  id: string;
  name: string;
  initial_population: number;
}

export interface PopulationEvent {
  id: string;
  region_id: string;
  type: "birth" | "death" | "migration_in" | "migration_out" | "census_correction";
  count: number;
  timestamp: string;
}

export interface CensusGroundTruth {
  initial_populations: Record<string, number>;
  batch_populations: Array<Record<string, number>>; // populations after each of 5 batches
  final_populations: Record<string, number>;
  total_events: number;
  total_final_population: number;
}

export interface CensusData {
  regions: Region[];
  batches: PopulationEvent[][]; // 5 batches of 20 events each
  groundTruth: CensusGroundTruth;
  objective: string;
}

const REGION_NAMES = [
  "Coral Bay",
  "Abyssal Shelf",
  "Kelp Meadow",
  "Thermal Vent Colony",
  "Pearl Lagoon",
  "Obsidian Ridge",
];

const EVENT_TYPES: PopulationEvent["type"][] = [
  "birth",
  "death",
  "migration_in",
  "migration_out",
  "census_correction",
];

function applyEvent(population: number, event: PopulationEvent): number {
  switch (event.type) {
    case "birth":
    case "migration_in":
      return population + event.count;
    case "death":
    case "migration_out":
      return population - event.count;
    case "census_correction":
      return population + event.count; // can be positive or negative
  }
}

export function generateCensusData(seed: number): CensusData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  // Build regions with initial populations (100-500)
  const regions: Region[] = REGION_NAMES.map((name, i) => ({
    id: `RGN-${String(i + 1).padStart(3, "0")}`,
    name,
    initial_population: randInt(100, 500),
  }));

  const regionIds = regions.map((r) => r.id);
  const initialPops: Record<string, number> = {};
  for (const r of regions) {
    initialPops[r.id] = r.initial_population;
  }

  // Generate 100 events in 5 batches of 20
  const baseDate = new Date("2026-02-01");
  const batches: PopulationEvent[][] = [];
  let eventCounter = 0;

  for (let b = 0; b < 5; b++) {
    const batch: PopulationEvent[] = [];
    for (let e = 0; e < 20; e++) {
      eventCounter++;
      const regionId = pick(regionIds);
      const eventType = pick(EVENT_TYPES);
      let count: number;

      switch (eventType) {
        case "birth":
          count = randInt(1, 10);
          break;
        case "death":
          count = randInt(1, 5);
          break;
        case "migration_in":
          count = randInt(5, 20);
          break;
        case "migration_out":
          count = randInt(5, 20);
          break;
        case "census_correction":
          // Can be positive or negative (-15 to +15, excluding 0)
          count = randInt(-15, 15);
          if (count === 0) count = 1;
          break;
      }

      const d = new Date(baseDate);
      d.setHours(d.getHours() + eventCounter);

      batch.push({
        id: `EVT-${String(eventCounter).padStart(4, "0")}`,
        region_id: regionId,
        type: eventType,
        count,
        timestamp: d.toISOString(),
      });
    }
    batches.push(batch);
  }

  // Compute ground truth: running populations after each batch
  const currentPops: Record<string, number> = { ...initialPops };
  const batchPopulations: Array<Record<string, number>> = [];

  for (const batch of batches) {
    for (const event of batch) {
      currentPops[event.region_id] = applyEvent(currentPops[event.region_id], event);
    }
    batchPopulations.push({ ...currentPops });
  }

  const finalPopulations = { ...currentPops };
  let totalFinalPopulation = 0;
  for (const pop of Object.values(finalPopulations)) {
    totalFinalPopulation += pop;
  }

  const objective = `Track population changes across 6 ocean regions over 5 batches of census events (100 total). Each batch contains 20 events: births (+1 to +10), deaths (-1 to -5), migrations in (+5 to +20), migrations out (-5 to -20), and census corrections (positive or negative, +/-1 to +/-15). Fetch regions for initial populations, then process each batch sequentially. Submit a checkpoint after each batch with running population counts per region. After all 5 batches, submit final population counts and the total population across all regions.`;

  return {
    regions,
    batches,
    groundTruth: {
      initial_populations: initialPops,
      batch_populations: batchPopulations,
      final_populations: finalPopulations,
      total_events: 100,
      total_final_population: totalFinalPopulation,
    },
    objective,
  };
}
