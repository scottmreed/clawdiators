import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ────────────────────────────────────────────────────────

export interface CensusRecord {
  district: string;
  population: number;
  density: number;
  median_income: number;
  employment_rate: number;
}

export interface FinancialRecord {
  district: string;
  tax_revenue: number;
  business_count: number;
  avg_business_revenue: number;
  gdp: number;
}

export interface EnvironmentalRecord {
  district: string;
  air_quality_index: number;
  water_quality: number;
  green_space_pct: number;
  co2_emissions: number;
}

export interface Fabrication {
  id: string;
  district: string;
  field: string;
  source: string;
  fabrication_type: string;
  explanation: string;
}

export interface MirageGroundTruth {
  fabrications: Fabrication[];
  clean_districts: string[];
}

export interface MirageData {
  census: CensusRecord[];
  financial: FinancialRecord[];
  environmental: EnvironmentalRecord[];
  groundTruth: MirageGroundTruth;
  objective: string;
}

// ── District names ────────────────────────────────────────────────────

const DISTRICT_NAMES = [
  "Coral Heights", "Tide Flats", "Abyssal Ward", "Kelp Basin",
  "Reef Terrace", "Shoal Gate", "Deepwater Rise", "Sandbar Commons",
  "Nautilus Quarter", "Urchin Hollow", "Driftwood Reach", "Barnacle Row",
  "Lagoon Crossing", "Seagrass Mile", "Pearl Bluff",
];

// ── Data generator ────────────────────────────────────────────────────

export function generateMirageData(seed: number): MirageData {
  const rng = mulberry32(seed);
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const randFloat = (min: number, max: number) => +(min + rng() * (max - min)).toFixed(2);

  // Shuffle district names deterministically
  const districts = [...DISTRICT_NAMES];
  for (let i = districts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [districts[i], districts[j]] = [districts[j], districts[i]];
  }

  // ── Generate consistent base data for all 15 districts ──────────

  const census: CensusRecord[] = [];
  const financial: FinancialRecord[] = [];
  const environmental: EnvironmentalRecord[] = [];

  for (const district of districts) {
    const population = randInt(8000, 250000);
    const density = randInt(200, 12000);
    const medianIncome = randInt(28000, 120000);
    const employmentRate = randFloat(55, 96);

    census.push({
      district,
      population,
      density,
      median_income: medianIncome,
      employment_rate: employmentRate,
    });

    // Financial data derived realistically from census
    const expectedTaxBase = population * medianIncome * 0.08;
    const taxRevenue = Math.round(expectedTaxBase * randFloat(0.7, 1.3));
    const businessCount = Math.max(10, Math.round(population / randInt(15, 60)));
    const avgBusinessRevenue = randInt(80000, 600000);
    const gdp = Math.round(population * medianIncome * randFloat(0.9, 1.4));

    financial.push({
      district,
      tax_revenue: taxRevenue,
      business_count: businessCount,
      avg_business_revenue: avgBusinessRevenue,
      gdp,
    });

    // Environmental data
    const airQuality = randInt(20, 95);
    const waterQuality = randFloat(3.0, 9.5);
    // CO2 roughly correlates with population and inverse of air quality
    const co2Base = population * 0.005 * (1 + (100 - airQuality) / 100);
    const co2Emissions = Math.round(co2Base * randFloat(0.7, 1.3));

    environmental.push({
      district,
      air_quality_index: airQuality,
      water_quality: waterQuality,
      green_space_pct: randFloat(2, 45),
      co2_emissions: co2Emissions,
    });
  }

  // ── Plant fabrications ──────────────────────────────────────────
  // Choose 8-10 districts to tamper with (some districts get >1 fabrication)

  const numFabrications = randInt(8, 10);
  const fabrications: Fabrication[] = [];

  // Shuffle indices for picking fabrication targets
  const indices = Array.from({ length: districts.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Define fabrication generators
  const fabricationGenerators: Array<(idx: number, fabId: string) => Fabrication> = [
    // Type 1: Low population but impossibly high tax revenue
    (idx, fabId) => {
      census[idx].population = randInt(800, 2500);
      financial[idx].tax_revenue = randInt(500_000_000, 2_000_000_000);
      return {
        id: fabId,
        district: districts[idx],
        field: "tax_revenue",
        source: "financial",
        fabrication_type: "impossible_ratio",
        explanation: `District has population of ${census[idx].population} but tax revenue of $${financial[idx].tax_revenue.toLocaleString()}, which is impossibly high for such a small population.`,
      };
    },
    // Type 2: Zero businesses but positive business_count in financial
    (idx, fabId) => {
      financial[idx].business_count = randInt(150, 400);
      financial[idx].avg_business_revenue = 0;
      return {
        id: fabId,
        district: districts[idx],
        field: "business_count",
        source: "financial",
        fabrication_type: "contradictory_values",
        explanation: `District reports ${financial[idx].business_count} businesses but avg_business_revenue is $0, which is contradictory.`,
      };
    },
    // Type 3: GDP is 100x population x median income
    (idx, fabId) => {
      const reasonableGdp = census[idx].population * census[idx].median_income;
      financial[idx].gdp = Math.round(reasonableGdp * randInt(80, 150));
      return {
        id: fabId,
        district: districts[idx],
        field: "gdp",
        source: "financial",
        fabrication_type: "statistical_outlier",
        explanation: `GDP of $${financial[idx].gdp.toLocaleString()} is ~${Math.round(financial[idx].gdp / reasonableGdp)}x the expected value based on population (${census[idx].population}) and median income ($${census[idx].median_income}).`,
      };
    },
    // Type 4: Very high air quality but extremely high CO2 emissions
    (idx, fabId) => {
      environmental[idx].air_quality_index = randInt(90, 99);
      environmental[idx].co2_emissions = randInt(5_000_000, 15_000_000);
      return {
        id: fabId,
        district: districts[idx],
        field: "co2_emissions",
        source: "environmental",
        fabrication_type: "contradictory_values",
        explanation: `District has excellent air quality index (${environmental[idx].air_quality_index}) but reports CO2 emissions of ${environmental[idx].co2_emissions.toLocaleString()} tonnes, which is contradictory.`,
      };
    },
    // Type 5: Employment rate > 100%
    (idx, fabId) => {
      census[idx].employment_rate = randFloat(105, 140);
      return {
        id: fabId,
        district: districts[idx],
        field: "employment_rate",
        source: "census",
        fabrication_type: "impossible_ratio",
        explanation: `Employment rate of ${census[idx].employment_rate}% exceeds 100%, which is impossible.`,
      };
    },
    // Type 6: Negative population density with large population
    (idx, fabId) => {
      census[idx].density = -randInt(500, 3000);
      return {
        id: fabId,
        district: districts[idx],
        field: "density",
        source: "census",
        fabrication_type: "contradictory_values",
        explanation: `Population density is negative (${census[idx].density}), which is physically impossible.`,
      };
    },
    // Type 7: Water quality out of possible range (0-14 pH scale, but value is extreme)
    (idx, fabId) => {
      environmental[idx].water_quality = randFloat(18, 35);
      return {
        id: fabId,
        district: districts[idx],
        field: "water_quality",
        source: "environmental",
        fabrication_type: "statistical_outlier",
        explanation: `Water quality reading of ${environmental[idx].water_quality} is far outside the valid pH range (0-14).`,
      };
    },
    // Type 8: Green space > 100%
    (idx, fabId) => {
      environmental[idx].green_space_pct = randFloat(105, 200);
      return {
        id: fabId,
        district: districts[idx],
        field: "green_space_pct",
        source: "environmental",
        fabrication_type: "impossible_ratio",
        explanation: `Green space percentage of ${environmental[idx].green_space_pct}% exceeds 100%, which is impossible.`,
      };
    },
    // Type 9: Median income negative
    (idx, fabId) => {
      census[idx].median_income = -randInt(15000, 50000);
      return {
        id: fabId,
        district: districts[idx],
        field: "median_income",
        source: "census",
        fabrication_type: "contradictory_values",
        explanation: `Median income of $${census[idx].median_income} is negative, which is impossible.`,
      };
    },
    // Type 10: Air quality index negative
    (idx, fabId) => {
      environmental[idx].air_quality_index = -randInt(10, 50);
      return {
        id: fabId,
        district: districts[idx],
        field: "air_quality_index",
        source: "environmental",
        fabrication_type: "contradictory_values",
        explanation: `Air quality index of ${environmental[idx].air_quality_index} is negative, which is impossible for an AQI reading.`,
      };
    },
  ];

  // Shuffle fabrication generators
  const genIndices = Array.from({ length: fabricationGenerators.length }, (_, i) => i);
  for (let i = genIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [genIndices[i], genIndices[j]] = [genIndices[j], genIndices[i]];
  }

  const usedDistricts = new Set<string>();
  for (let f = 0; f < numFabrications; f++) {
    const districtIdx = indices[f % indices.length];
    const genIdx = genIndices[f % genIndices.length];
    const fabId = `fab-${seed}-${f + 1}`;
    const fabrication = fabricationGenerators[genIdx](districtIdx, fabId);
    fabrications.push(fabrication);
    usedDistricts.add(districts[districtIdx]);
  }

  // Districts that were NOT tampered with
  const cleanDistricts = districts.filter((d) => !usedDistricts.has(d));

  const groundTruth: MirageGroundTruth = {
    fabrications,
    clean_districts: cleanDistricts,
  };

  const objective =
    "Three data sources describe 15 districts: census, financial, and environmental. " +
    "Each source is internally formatted consistently, but some data points have been fabricated. " +
    "Cross-reference the sources to identify 8\u201310 impossible or contradictory values. " +
    "Submit an array of fabrications, each with the district name, the suspect field, " +
    "the source it appears in, and an explanation of why it is fabricated.";

  return { census, financial, environmental, groundTruth, objective };
}
