import { mulberry32 } from "../../services/whimsy.js";

// ── Interfaces ────────────────────────────────────────────────────────

export interface CensusRecord {
  district: string;
  population: number;
  median_age: number;
  household_count: number;
}

export interface HospitalRecord {
  district: string;
  beds: number;
  staff: number;
  patients_daily: number;
  emergency_visits: number;
}

export interface SchoolRecord {
  district: string;
  schools_count: number;
  students: number;
  teachers: number;
  graduation_rate: number;
}

export interface BusinessRecord {
  district: string;
  businesses: number;
  revenue_total: number;
  employees_total: number;
  tax_revenue: number;
}

export interface SwitchboardQuestion {
  id: string;
  question: string;
  authoritative_sources: string[];
}

export interface SwitchboardGroundTruth {
  answers: Array<{
    question_id: string;
    answer: string;
    value: number;
    sources_needed: string[];
  }>;
}

export interface SwitchboardData {
  census: CensusRecord[];
  hospital: HospitalRecord[];
  school: SchoolRecord[];
  business: BusinessRecord[];
  questions: SwitchboardQuestion[];
  groundTruth: SwitchboardGroundTruth;
  objective: string;
}

// ── District name pool ────────────────────────────────────────────────

const DISTRICT_COUNT = 20;

function districtName(i: number): string {
  return `District-${String(i + 1).padStart(2, "0")}`;
}

// ── Data generation ───────────────────────────────────────────────────

export function generateSwitchboardData(seed: number): SwitchboardData {
  const rng = mulberry32(seed);
  const randInt = (min: number, max: number) =>
    Math.floor(rng() * (max - min + 1)) + min;

  // Generate district data for all 4 sources
  const census: CensusRecord[] = [];
  const hospital: HospitalRecord[] = [];
  const school: SchoolRecord[] = [];
  const business: BusinessRecord[] = [];

  for (let i = 0; i < DISTRICT_COUNT; i++) {
    const name = districtName(i);

    census.push({
      district: name,
      population: randInt(8000, 120000),
      median_age: randInt(22, 55),
      household_count: randInt(2000, 40000),
    });

    hospital.push({
      district: name,
      beds: randInt(50, 800),
      staff: randInt(30, 500),
      patients_daily: randInt(20, 400),
      emergency_visits: randInt(5, 200),
    });

    school.push({
      district: name,
      schools_count: randInt(2, 30),
      students: randInt(500, 15000),
      teachers: randInt(30, 800),
      graduation_rate: parseFloat((rng() * 0.35 + 0.60).toFixed(2)), // 0.60-0.95
    });

    business.push({
      district: name,
      businesses: randInt(50, 2000),
      revenue_total: randInt(500000, 50000000),
      employees_total: randInt(200, 30000),
      tax_revenue: randInt(50000, 5000000),
    });
  }

  // ── Build 5 cross-referencing questions ───────────────────────────

  // Q1: highest ratio of hospital beds to population (census + hospital)
  let bestQ1 = { district: "", value: -1 };
  for (let i = 0; i < DISTRICT_COUNT; i++) {
    const ratio = hospital[i].beds / census[i].population;
    if (ratio > bestQ1.value) {
      bestQ1 = { district: census[i].district, value: ratio };
    }
  }

  // Q2: most students per school (school only)
  let bestQ2 = { district: "", value: -1 };
  for (let i = 0; i < DISTRICT_COUNT; i++) {
    const ratio = school[i].students / school[i].schools_count;
    if (ratio > bestQ2.value) {
      bestQ2 = { district: school[i].district, value: ratio };
    }
  }

  // Q3: highest business revenue per capita (census + business)
  let bestQ3 = { district: "", value: -1 };
  for (let i = 0; i < DISTRICT_COUNT; i++) {
    const ratio = business[i].revenue_total / census[i].population;
    if (ratio > bestQ3.value) {
      bestQ3 = { district: census[i].district, value: ratio };
    }
  }

  // Q4: best teacher-to-student ratio (school only, lower is better = more teachers per student)
  let bestQ4 = { district: "", value: Infinity };
  for (let i = 0; i < DISTRICT_COUNT; i++) {
    const ratio = school[i].students / school[i].teachers;
    if (ratio < bestQ4.value) {
      bestQ4 = { district: school[i].district, value: ratio };
    }
  }

  // Q5: highest emergency visits per 1000 residents (census + hospital)
  let bestQ5 = { district: "", value: -1 };
  for (let i = 0; i < DISTRICT_COUNT; i++) {
    const ratio = (hospital[i].emergency_visits / census[i].population) * 1000;
    if (ratio > bestQ5.value) {
      bestQ5 = { district: hospital[i].district, value: ratio };
    }
  }

  const questions: SwitchboardQuestion[] = [
    {
      id: `sw-${seed}-q1`,
      question:
        "Which district has the highest ratio of hospital beds to population?",
      authoritative_sources: ["census", "hospital"],
    },
    {
      id: `sw-${seed}-q2`,
      question: "Which district has the most students per school?",
      authoritative_sources: ["school"],
    },
    {
      id: `sw-${seed}-q3`,
      question:
        "Which district has the highest business revenue per capita?",
      authoritative_sources: ["census", "business"],
    },
    {
      id: `sw-${seed}-q4`,
      question:
        "Which district has the best teacher-to-student ratio?",
      authoritative_sources: ["school"],
    },
    {
      id: `sw-${seed}-q5`,
      question:
        "Which district has the highest emergency visits per 1000 residents?",
      authoritative_sources: ["census", "hospital"],
    },
  ];

  const groundTruth: SwitchboardGroundTruth = {
    answers: [
      {
        question_id: `sw-${seed}-q1`,
        answer: bestQ1.district,
        value: parseFloat(bestQ1.value.toFixed(6)),
        sources_needed: ["census", "hospital"],
      },
      {
        question_id: `sw-${seed}-q2`,
        answer: bestQ2.district,
        value: parseFloat(bestQ2.value.toFixed(2)),
        sources_needed: ["school"],
      },
      {
        question_id: `sw-${seed}-q3`,
        answer: bestQ3.district,
        value: parseFloat(bestQ3.value.toFixed(2)),
        sources_needed: ["census", "business"],
      },
      {
        question_id: `sw-${seed}-q4`,
        answer: bestQ4.district,
        value: parseFloat(bestQ4.value.toFixed(2)),
        sources_needed: ["school"],
      },
      {
        question_id: `sw-${seed}-q5`,
        answer: bestQ5.district,
        value: parseFloat(bestQ5.value.toFixed(2)),
        sources_needed: ["census", "hospital"],
      },
    ],
  };

  const objective =
    "Query 4 overlapping data sources (census, hospital, school, business) covering 20 districts. " +
    "Answer 5 cross-referencing questions by selecting the most authoritative source(s) for each. " +
    "Submit answers as { [question_id]: district_name } with an optional sources_used field " +
    "as { [question_id]: string[] } indicating which APIs you consulted per question.";

  return {
    census,
    hospital,
    school,
    business,
    questions,
    groundTruth,
    objective,
  };
}
