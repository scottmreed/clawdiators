import { mulberry32 } from "../../services/whimsy.js";

export interface BrokenFunction {
  id: string;
  name: string;
  description: string;
  language: string;
  code: string;
  bug_description: string;
  test_cases: TestCase[];
}

export interface TestCase {
  input: unknown;
  expected_output: unknown;
}

export interface RefactorGroundTruth {
  functions: Array<{
    id: string;
    correct_outputs: unknown[];
  }>;
}

export interface RefactorData {
  functions: BrokenFunction[];
  groundTruth: RefactorGroundTruth;
  objective: string;
}

interface FunctionTemplate {
  name: string;
  description: string;
  makeBroken: (rng: () => number) => {
    code: string;
    bug_description: string;
    testCases: TestCase[];
    correctOutputs: unknown[];
  };
}

// ── Novel procedural function templates ─────────────────────────────
// Each generates unique business logic per seed that requires careful
// code tracing to determine correct outputs.

const templates: FunctionTemplate[] = [
  {
    name: "calculate_shipping",
    description: "Calculate shipping cost. Rules: base rate per kg depends on zone (1: $2/kg, 2: $3.5/kg, 3: $5/kg). Orders over weightThreshold kg get a bulk discount of discountPct% off. Fragile items add a flat surcharge. Returns total cost rounded to 2 decimal places.",
    makeBroken: (rng) => {
      const weightThreshold = 10 + Math.floor(rng() * 15);
      const discountPct = 10 + Math.floor(rng() * 20);
      const fragileSurcharge = 5 + Math.floor(rng() * 10);
      const bugType = Math.floor(rng() * 3);

      const zoneRates: Record<number, number> = { 1: 2, 2: 3.5, 3: 5 };
      const correct = (weight: number, zone: number, fragile: boolean) => {
        const base = weight * (zoneRates[zone] ?? 5);
        const afterDiscount = weight > weightThreshold ? base * (1 - discountPct / 100) : base;
        const total = fragile ? afterDiscount + fragileSurcharge : afterDiscount;
        return Math.round(total * 100) / 100;
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function calculate_shipping(weight, zone, fragile) {
  const rates = { 1: 2, 2: 3.5, 3: 5 };
  let cost = weight * (rates[zone] || 5);
  if (weight >= ${weightThreshold}) {
    cost = cost * (1 - ${discountPct} / 100);
  }
  if (fragile) cost += ${fragileSurcharge};
  return Math.round(cost * 100) / 100;
}`;
        bug = `Bulk discount threshold uses >= instead of >. Orders exactly at ${weightThreshold}kg incorrectly get the discount.`;
      } else if (bugType === 1) {
        code = `function calculate_shipping(weight, zone, fragile) {
  const rates = { 1: 2, 2: 3.5, 3: 5 };
  let cost = weight * (rates[zone] || 5);
  if (weight > ${weightThreshold}) {
    cost = cost * (${discountPct} / 100);
  }
  if (fragile) cost += ${fragileSurcharge};
  return Math.round(cost * 100) / 100;
}`;
        bug = `Discount multiplier is ${discountPct}/100 instead of (1 - ${discountPct}/100). Returns the discount amount, not the discounted price.`;
      } else {
        code = `function calculate_shipping(weight, zone, fragile) {
  const rates = { 1: 2, 2: 3.5, 3: 5 };
  let cost = weight * (rates[zone] || 5);
  if (weight > ${weightThreshold}) {
    cost = cost * (1 - ${discountPct} / 100);
  }
  if (fragile) cost = cost * ${fragileSurcharge};
  return Math.round(cost * 100) / 100;
}`;
        bug = `Fragile surcharge is multiplied instead of added. Should be cost + ${fragileSurcharge}, not cost * ${fragileSurcharge}.`;
      }

      const cases = [
        { w: 5, z: 1, f: false },
        { w: 5, z: 2, f: true },
        { w: 0, z: 1, f: false },
        { w: weightThreshold - 1, z: 3, f: false },
        { w: weightThreshold, z: 1, f: false },
        { w: weightThreshold + 1, z: 1, f: false },
        { w: weightThreshold + 5, z: 3, f: true },
        { w: weightThreshold + 10, z: 2, f: false },
        { w: 1, z: 3, f: true },
        { w: weightThreshold + 12, z: 99, f: true },
      ];

      return {
        code,
        bug_description: bug,
        testCases: cases.map(c => ({
          input: { weight: c.w, zone: c.z, fragile: c.f },
          expected_output: correct(c.w, c.z, c.f),
        })),
        correctOutputs: cases.map(c => correct(c.w, c.z, c.f)),
      };
    },
  },
  {
    name: "employee_bonus",
    description: "Calculate employee bonus. Performance rating (1-5) determines base multiplier: 1=0, 2=0.5, 3=1.0, 4=1.5, 5=2.0 months salary. Tenure years add tenureBonus% per year (capped at maxTenureYears years). If rating >= 4 AND tenure >= seniorThreshold, add an extra seniorExtra flat bonus. Returns total bonus rounded to nearest integer.",
    makeBroken: (rng) => {
      const tenureBonus = 2 + Math.floor(rng() * 4);
      const maxTenureYears = 8 + Math.floor(rng() * 7);
      const seniorThreshold = 3 + Math.floor(rng() * 5);
      const seniorExtra = 500 + Math.floor(rng() * 1500);
      const ratingMultipliers = [0, 0, 0.5, 1.0, 1.5, 2.0];
      const bugType = Math.floor(rng() * 3);

      const correct = (salary: number, rating: number, tenure: number) => {
        const baseMult = ratingMultipliers[rating] ?? 0;
        let bonus = salary * baseMult;
        const cappedTenure = Math.min(tenure, maxTenureYears);
        bonus *= (1 + cappedTenure * tenureBonus / 100);
        if (rating >= 4 && tenure >= seniorThreshold) {
          bonus += seniorExtra;
        }
        return Math.round(bonus);
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function employee_bonus(salary, rating, tenure) {
  const multipliers = [0, 0, 0.5, 1.0, 1.5, 2.0];
  let bonus = salary * (multipliers[rating] || 0);
  const cappedTenure = Math.min(tenure, ${maxTenureYears});
  bonus *= (1 + cappedTenure * ${tenureBonus} / 100);
  if (rating >= 4 || tenure >= ${seniorThreshold}) {
    bonus += ${seniorExtra};
  }
  return Math.round(bonus);
}`;
        bug = `Senior bonus condition uses OR instead of AND. Should require BOTH rating >= 4 AND tenure >= ${seniorThreshold}.`;
      } else if (bugType === 1) {
        code = `function employee_bonus(salary, rating, tenure) {
  const multipliers = [0, 0, 0.5, 1.0, 1.5, 2.0];
  let bonus = salary * (multipliers[rating] || 0);
  bonus *= (1 + tenure * ${tenureBonus} / 100);
  if (rating >= 4 && tenure >= ${seniorThreshold}) {
    bonus += ${seniorExtra};
  }
  return Math.round(bonus);
}`;
        bug = `Tenure is not capped at ${maxTenureYears} years. Long-tenured employees get an unbounded tenure multiplier.`;
      } else {
        code = `function employee_bonus(salary, rating, tenure) {
  const multipliers = [0, 0, 0.5, 1.0, 1.5, 2.0];
  let bonus = salary * (multipliers[rating] || 0);
  const cappedTenure = Math.min(tenure, ${maxTenureYears});
  bonus += (1 + cappedTenure * ${tenureBonus} / 100);
  if (rating >= 4 && tenure >= ${seniorThreshold}) {
    bonus += ${seniorExtra};
  }
  return Math.round(bonus);
}`;
        bug = `Tenure multiplier is ADDED instead of MULTIPLIED. Should be bonus *= (1 + ...) not bonus += (1 + ...).`;
      }

      const cases = [
        { s: 5000, r: 3, t: 2 },
        { s: 5000, r: 4, t: seniorThreshold - 1 },
        { s: 8000, r: 5, t: seniorThreshold },
        { s: 6000, r: 4, t: seniorThreshold - 1 },
        { s: 6000, r: 4, t: seniorThreshold },
        { s: 7000, r: 2, t: maxTenureYears + 3 },
        { s: 7000, r: 2, t: maxTenureYears },
        { s: 10000, r: 5, t: maxTenureYears + 5 },
        { s: 4000, r: 1, t: 10 },
        { s: 4500, r: 1, t: 0 },
      ];

      return {
        code,
        bug_description: bug,
        testCases: cases.map(c => ({
          input: { salary: c.s, rating: c.r, tenure: c.t },
          expected_output: correct(c.s, c.r, c.t),
        })),
        correctOutputs: cases.map(c => correct(c.s, c.r, c.t)),
      };
    },
  },
  {
    name: "ticket_price",
    description: "Calculate ticket price. Base price varies by showtime: morning (before hour 12) costs baseMorning, afternoon (12-17) costs baseAfternoon, evening (17+) costs baseEvening. Age discounts: children (age < childAge) get childDiscount% off, seniors (age >= seniorAge) get seniorDiscount% off. Groups of groupMin+ get an additional groupDiscount% off (applied AFTER age discount). Returns price rounded to 2 decimal places.",
    makeBroken: (rng) => {
      const baseMorning = 8 + Math.floor(rng() * 5);
      const baseAfternoon = 12 + Math.floor(rng() * 5);
      const baseEvening = 15 + Math.floor(rng() * 8);
      const childAge = 10 + Math.floor(rng() * 4);
      const seniorAge = 60 + Math.floor(rng() * 10);
      const childDiscount = 30 + Math.floor(rng() * 20);
      const seniorDiscount = 20 + Math.floor(rng() * 15);
      const groupMin = 4 + Math.floor(rng() * 4);
      const groupDiscount = 10 + Math.floor(rng() * 10);
      const bugType = Math.floor(rng() * 3);

      const correct = (hour: number, age: number, groupSize: number) => {
        let price = hour < 12 ? baseMorning : hour < 17 ? baseAfternoon : baseEvening;
        if (age < childAge) price *= (1 - childDiscount / 100);
        else if (age >= seniorAge) price *= (1 - seniorDiscount / 100);
        if (groupSize >= groupMin) price *= (1 - groupDiscount / 100);
        return Math.round(price * 100) / 100;
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function ticket_price(hour, age, groupSize) {
  let price;
  if (hour < 12) price = ${baseMorning};
  else if (hour <= 17) price = ${baseAfternoon};
  else price = ${baseEvening};
  if (age < ${childAge}) price *= (1 - ${childDiscount} / 100);
  else if (age >= ${seniorAge}) price *= (1 - ${seniorDiscount} / 100);
  if (groupSize >= ${groupMin}) price *= (1 - ${groupDiscount} / 100);
  return Math.round(price * 100) / 100;
}`;
        bug = `Afternoon range uses <= 17 instead of < 17. Hour 17 should be evening (${baseEvening}) but gets afternoon price (${baseAfternoon}).`;
      } else if (bugType === 1) {
        code = `function ticket_price(hour, age, groupSize) {
  let price;
  if (hour < 12) price = ${baseMorning};
  else if (hour < 17) price = ${baseAfternoon};
  else price = ${baseEvening};
  if (age < ${childAge}) price *= (1 - ${childDiscount} / 100);
  if (age >= ${seniorAge}) price *= (1 - ${seniorDiscount} / 100);
  if (groupSize >= ${groupMin}) price *= (1 - ${groupDiscount} / 100);
  return Math.round(price * 100) / 100;
}`;
        bug = `Child and senior discounts are not mutually exclusive (else-if changed to if). A person who is both < ${childAge} and >= ${seniorAge} would get both discounts (impossible in practice, but ages between these get no double-discount issue; the real bug is that the senior check is a separate if, meaning it runs independently — a senior ALSO below childAge would get both).`;
      } else {
        code = `function ticket_price(hour, age, groupSize) {
  let price;
  if (hour < 12) price = ${baseMorning};
  else if (hour < 17) price = ${baseAfternoon};
  else price = ${baseEvening};
  if (age < ${childAge}) price *= (1 - ${childDiscount} / 100);
  else if (age >= ${seniorAge}) price *= (1 - ${seniorDiscount} / 100);
  if (groupSize > ${groupMin}) price *= (1 - ${groupDiscount} / 100);
  return Math.round(price * 100) / 100;
}`;
        bug = `Group discount uses > instead of >=. A group of exactly ${groupMin} should get the discount but doesn't.`;
      }

      const cases = [
        { h: 10, a: 25, g: 1 },
        { h: 14, a: childAge - 2, g: 1 },
        { h: 11, a: childAge - 1, g: groupMin - 1 },
        { h: 12, a: childAge - 1, g: groupMin },
        { h: 17, a: seniorAge + 1, g: groupMin },
        { h: 16, a: seniorAge, g: groupMin - 1 },
        { h: 20, a: 30, g: groupMin },
        { h: 9, a: seniorAge, g: groupMin - 1 },
        { h: 12, a: childAge, g: groupMin + 2 },
        { h: 17, a: 25, g: groupMin - 1 },
      ];

      return {
        code,
        bug_description: bug,
        testCases: cases.map(c => ({
          input: { hour: c.h, age: c.a, group_size: c.g },
          expected_output: correct(c.h, c.a, c.g),
        })),
        correctOutputs: cases.map(c => correct(c.h, c.a, c.g)),
      };
    },
  },
  {
    name: "grade_calculator",
    description: "Calculate final grade. Takes an array of {category, score, weight} entries. For each category, compute weighted contribution = score * weight / 100. Sum all contributions. Then apply curve: if raw >= curveThreshold, add curveBonus points (capped at 100). If any single category score is below failThreshold, the final grade is capped at cappedMax regardless of total. Return the final grade rounded to 1 decimal place.",
    makeBroken: (rng) => {
      const curveThreshold = 60 + Math.floor(rng() * 15);
      const curveBonus = 3 + Math.floor(rng() * 7);
      const failThreshold = 30 + Math.floor(rng() * 20);
      const cappedMax = 50 + Math.floor(rng() * 10);
      const bugType = Math.floor(rng() * 3);

      const correct = (entries: Array<{ category: string; score: number; weight: number }>) => {
        let raw = 0;
        let anyFail = false;
        for (const e of entries) {
          raw += e.score * e.weight / 100;
          if (e.score < failThreshold) anyFail = true;
        }
        if (raw >= curveThreshold) raw = Math.min(100, raw + curveBonus);
        if (anyFail) raw = Math.min(raw, cappedMax);
        return Math.round(raw * 10) / 10;
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function grade_calculator(entries) {
  let raw = 0;
  let anyFail = false;
  for (const e of entries) {
    raw += e.score * e.weight / 100;
    if (e.score < ${failThreshold}) anyFail = true;
  }
  if (raw >= ${curveThreshold}) raw = Math.min(100, raw + ${curveBonus});
  if (anyFail) raw = Math.min(raw, ${cappedMax});
  return Math.round(raw * 10) / 10;
}`;
        // No bug in this variant — used as a control. Actually, let me add a bug.
        code = `function grade_calculator(entries) {
  let raw = 0;
  let anyFail = false;
  for (const e of entries) {
    raw += e.score * e.weight / 100;
    if (e.score <= ${failThreshold}) anyFail = true;
  }
  if (raw >= ${curveThreshold}) raw = Math.min(100, raw + ${curveBonus});
  if (anyFail) raw = Math.min(raw, ${cappedMax});
  return Math.round(raw * 10) / 10;
}`;
        bug = `Fail check uses <= instead of <. A score of exactly ${failThreshold} should NOT trigger the fail cap, but this code treats it as failing.`;
      } else if (bugType === 1) {
        code = `function grade_calculator(entries) {
  let raw = 0;
  let anyFail = false;
  for (const e of entries) {
    raw += e.score * e.weight / 100;
    if (e.score < ${failThreshold}) anyFail = true;
  }
  if (anyFail) raw = Math.min(raw, ${cappedMax});
  if (raw >= ${curveThreshold}) raw = Math.min(100, raw + ${curveBonus});
  return Math.round(raw * 10) / 10;
}`;
        bug = `Fail cap is applied BEFORE the curve bonus. The correct order is: curve first, then cap. This means a student with a failing category who would have been curved above the cap gets curved AFTER being capped, potentially exceeding the cap.`;
      } else {
        code = `function grade_calculator(entries) {
  let raw = 0;
  let anyFail = false;
  for (const e of entries) {
    raw += e.score * (e.weight / 100);
    if (e.score < ${failThreshold}) anyFail = true;
  }
  if (raw > ${curveThreshold}) raw = Math.min(100, raw + ${curveBonus});
  if (anyFail) raw = Math.min(raw, ${cappedMax});
  return Math.round(raw * 10) / 10;
}`;
        bug = `Curve condition uses > instead of >=. A raw score of exactly ${curveThreshold} should get the curve bonus but doesn't.`;
      }

      const makeEntries = (scores: number[], weights: number[]) =>
        scores.map((s, i) => ({ category: `cat${i}`, score: s, weight: weights[i] }));

      const w = [40, 30, 30];
      const cases = [
        makeEntries([80, 70, 90], w),
        makeEntries([failThreshold - 1, 95, 85], w),
        makeEntries([failThreshold, 80, 75], w),
        makeEntries([failThreshold + 1, 80, 75], w),
        makeEntries([curveThreshold * 100 / 40, 70, 60], w),
        makeEntries([curveThreshold * 100 / 40 - 0.1, 70, 60], w),
        makeEntries([curveThreshold * 100 / 40 + 0.1, 70, 60], w),
        makeEntries([100, 100, 100], w),
        makeEntries([failThreshold - 5, failThreshold + 5, 50], w),
        makeEntries([0, 0, 0], w),
      ];

      return {
        code,
        bug_description: bug,
        testCases: cases.map(c => ({ input: c, expected_output: correct(c) })),
        correctOutputs: cases.map(c => correct(c)),
      };
    },
  },
  {
    name: "inventory_reorder",
    description: "Determine reorder quantities for inventory items. Each item has: current stock, daily demand, lead time (days to restock), and safety stock days. Reorder point = (daily_demand * lead_time) + (daily_demand * safety_stock_days). If current stock <= reorder point, order enough to reach target stock = reorder point + (daily_demand * bufferDays). Reorder quantity = target - current (minimum 0). Return array of { item, reorder_qty } for items that need reordering (qty > 0 only).",
    makeBroken: (rng) => {
      const bufferDays = 5 + Math.floor(rng() * 10);
      const bugType = Math.floor(rng() * 3);

      type Item = { item: string; stock: number; daily_demand: number; lead_time: number; safety_days: number };

      const correct = (items: Item[]) => {
        const results: Array<{ item: string; reorder_qty: number }> = [];
        for (const it of items) {
          const reorderPoint = (it.daily_demand * it.lead_time) + (it.daily_demand * it.safety_days);
          if (it.stock <= reorderPoint) {
            const target = reorderPoint + (it.daily_demand * bufferDays);
            const qty = Math.max(0, target - it.stock);
            if (qty > 0) results.push({ item: it.item, reorder_qty: qty });
          }
        }
        return results;
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function inventory_reorder(items) {
  const results = [];
  for (const it of items) {
    const reorderPoint = it.daily_demand * it.lead_time + it.daily_demand * it.safety_days;
    if (it.stock < reorderPoint) {
      const target = reorderPoint + it.daily_demand * ${bufferDays};
      const qty = Math.max(0, target - it.stock);
      if (qty > 0) results.push({ item: it.item, reorder_qty: qty });
    }
  }
  return results;
}`;
        bug = `Reorder check uses < instead of <=. Items with stock exactly at the reorder point should trigger reorder but don't.`;
      } else if (bugType === 1) {
        code = `function inventory_reorder(items) {
  const results = [];
  for (const it of items) {
    const reorderPoint = it.daily_demand * (it.lead_time + it.safety_days);
    if (it.stock <= reorderPoint) {
      const target = reorderPoint + it.daily_demand * ${bufferDays};
      const qty = Math.max(0, target - it.stock);
      if (qty > 0) results.push({ item: it.item, reorder_qty: qty });
    }
  }
  return results;
}`;
        bug = `Reorder point formula uses daily_demand * (lead_time + safety_days) instead of (daily_demand * lead_time) + (daily_demand * safety_days). These are mathematically identical, so this version is actually correct. The real bug is elsewhere — wait, these ARE identical: d*(l+s) = d*l + d*s. Let me use a different bug.`;
      } else {
        code = `function inventory_reorder(items) {
  const results = [];
  for (const it of items) {
    const reorderPoint = it.daily_demand * it.lead_time + it.daily_demand * it.safety_days;
    if (it.stock <= reorderPoint) {
      const target = reorderPoint + it.daily_demand + ${bufferDays};
      const qty = Math.max(0, target - it.stock);
      if (qty > 0) results.push({ item: it.item, reorder_qty: qty });
    }
  }
  return results;
}`;
        bug = `Target calculation uses daily_demand + ${bufferDays} instead of daily_demand * ${bufferDays}. Addition instead of multiplication for the buffer term.`;
      }

      // Fix bugType 1 to have a real bug
      if (bugType === 1) {
        code = `function inventory_reorder(items) {
  const results = [];
  for (const it of items) {
    const reorderPoint = it.daily_demand * it.lead_time + it.safety_days;
    if (it.stock <= reorderPoint) {
      const target = reorderPoint + it.daily_demand * ${bufferDays};
      const qty = Math.max(0, target - it.stock);
      if (qty > 0) results.push({ item: it.item, reorder_qty: qty });
    }
  }
  return results;
}`;
        bug = `Reorder point formula is missing the daily_demand multiplier on safety_days. Should be daily_demand * safety_days, not just safety_days.`;
      }

      const items: Item[] = [
        { item: "Widget-A", stock: 50, daily_demand: 10, lead_time: 3, safety_days: 2 },
        { item: "Widget-B", stock: 200, daily_demand: 5, lead_time: 7, safety_days: 3 },
        { item: "Gizmo-X", stock: 30, daily_demand: 8, lead_time: 4, safety_days: 2 },
        { item: "Part-Y", stock: 100, daily_demand: 15, lead_time: 2, safety_days: 1 },
        { item: "Module-Z", stock: 0, daily_demand: 20, lead_time: 5, safety_days: 3 },
      ];

      return {
        code,
        bug_description: bug,
        testCases: [{ input: items, expected_output: correct(items) }],
        correctOutputs: [correct(items)],
      };
    },
  },
  {
    name: "commission_calc",
    description: "Calculate sales commission. Revenue tiers determine the rate: below tier1 threshold = rate1%, between tier1 and tier2 = rate2%, above tier2 = rate3%. Commission is MARGINAL (like tax brackets): rate1 applies to first tier1, rate2 to amount between tier1 and tier2, rate3 to amount above tier2. If the salesperson exceeded their quarterly quota, add quotaBonus flat bonus. Return total commission rounded to 2 decimal places.",
    makeBroken: (rng) => {
      const tier1 = (5 + Math.floor(rng() * 10)) * 1000;
      const tier2 = tier1 + (10 + Math.floor(rng() * 15)) * 1000;
      const rate1 = 5 + Math.floor(rng() * 5);
      const rate2 = rate1 + 3 + Math.floor(rng() * 5);
      const rate3 = rate2 + 2 + Math.floor(rng() * 5);
      const quota = tier1 + Math.floor(rng() * (tier2 - tier1));
      const quotaBonus = 200 + Math.floor(rng() * 800);
      const bugType = Math.floor(rng() * 3);

      const correct = (revenue: number, exceededQuota: boolean) => {
        let commission = 0;
        if (revenue <= tier1) {
          commission = revenue * rate1 / 100;
        } else if (revenue <= tier2) {
          commission = tier1 * rate1 / 100 + (revenue - tier1) * rate2 / 100;
        } else {
          commission = tier1 * rate1 / 100 + (tier2 - tier1) * rate2 / 100 + (revenue - tier2) * rate3 / 100;
        }
        if (exceededQuota) commission += quotaBonus;
        return Math.round(commission * 100) / 100;
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function commission_calc(revenue, exceededQuota) {
  let commission = 0;
  if (revenue <= ${tier1}) {
    commission = revenue * ${rate1} / 100;
  } else if (revenue <= ${tier2}) {
    commission = revenue * ${rate2} / 100;
  } else {
    commission = revenue * ${rate3} / 100;
  }
  if (exceededQuota) commission += ${quotaBonus};
  return Math.round(commission * 100) / 100;
}`;
        bug = `Applies each tier's rate to the ENTIRE revenue instead of marginally. Should apply rate1 to first ${tier1}, rate2 to amount between ${tier1} and ${tier2}, etc.`;
      } else if (bugType === 1) {
        code = `function commission_calc(revenue, exceededQuota) {
  let commission = 0;
  if (revenue <= ${tier1}) {
    commission = revenue * ${rate1} / 100;
  } else if (revenue <= ${tier2}) {
    commission = ${tier1} * ${rate1} / 100 + (revenue - ${tier1}) * ${rate2} / 100;
  } else {
    commission = ${tier1} * ${rate1} / 100 + (revenue - ${tier1}) * ${rate2} / 100 + (revenue - ${tier2}) * ${rate3} / 100;
  }
  if (exceededQuota) commission += ${quotaBonus};
  return Math.round(commission * 100) / 100;
}`;
        bug = `In the top tier, the middle bracket uses (revenue - ${tier1}) instead of (${tier2} - ${tier1}). The middle bracket should have a fixed size.`;
      } else {
        code = `function commission_calc(revenue, exceededQuota) {
  let commission = 0;
  if (revenue <= ${tier1}) {
    commission = revenue * ${rate1} / 100;
  } else if (revenue <= ${tier2}) {
    commission = ${tier1} * ${rate1} / 100 + (revenue - ${tier1}) * ${rate2} / 100;
  } else {
    commission = ${tier1} * ${rate1} / 100 + (${tier2} - ${tier1}) * ${rate2} / 100 + (revenue - ${tier2}) * ${rate3} / 100;
  }
  if (exceededQuota) commission = commission + ${quotaBonus};
  return Math.round(commission);
}`;
        bug = `Final rounding uses Math.round(commission) instead of Math.round(commission * 100) / 100. Rounds to nearest integer instead of 2 decimal places.`;
      }

      const cases = [
        { r: tier1 - 1000, q: false },
        { r: tier1 - 1, q: false },
        { r: tier1, q: true },
        { r: tier1 + 1, q: false },
        { r: tier1 + 5000, q: false },
        { r: tier2 - 1, q: false },
        { r: tier2, q: true },
        { r: tier2 + 1, q: false },
        { r: tier2 + 10000, q: false },
        { r: tier2 + 20000, q: true },
      ];

      return {
        code,
        bug_description: bug,
        testCases: cases.map(c => ({
          input: { revenue: c.r, exceeded_quota: c.q },
          expected_output: correct(c.r, c.q),
        })),
        correctOutputs: cases.map(c => correct(c.r, c.q)),
      };
    },
  },
  {
    name: "schedule_overlap",
    description: "Find all overlapping time slots between two calendars. Each calendar is an array of {start, end} objects (integers representing minutes from midnight). Two slots overlap if one starts before the other ends AND ends after the other starts. Return array of overlapping pairs as {slot_a_idx, slot_b_idx, overlap_minutes} where overlap_minutes = min(endA, endB) - max(startA, startB). Only include pairs where overlap_minutes > minOverlap.",
    makeBroken: (rng) => {
      const minOverlap = 10 + Math.floor(rng() * 20);
      const bugType = Math.floor(rng() * 3);

      type Slot = { start: number; end: number };
      const correct = (calA: Slot[], calB: Slot[]) => {
        const results: Array<{ slot_a_idx: number; slot_b_idx: number; overlap_minutes: number }> = [];
        for (let i = 0; i < calA.length; i++) {
          for (let j = 0; j < calB.length; j++) {
            const overlapStart = Math.max(calA[i].start, calB[j].start);
            const overlapEnd = Math.min(calA[i].end, calB[j].end);
            const overlap = overlapEnd - overlapStart;
            if (overlap > minOverlap) {
              results.push({ slot_a_idx: i, slot_b_idx: j, overlap_minutes: overlap });
            }
          }
        }
        return results;
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function schedule_overlap(calA, calB) {
  const results = [];
  for (let i = 0; i < calA.length; i++) {
    for (let j = 0; j < calB.length; j++) {
      const overlapStart = Math.min(calA[i].start, calB[j].start);
      const overlapEnd = Math.max(calA[i].end, calB[j].end);
      const overlap = overlapEnd - overlapStart;
      if (overlap > ${minOverlap}) {
        results.push({ slot_a_idx: i, slot_b_idx: j, overlap_minutes: overlap });
      }
    }
  }
  return results;
}`;
        bug = `Overlap calculation is inverted: uses min for start and max for end. Should be max(startA, startB) and min(endA, endB). This computes the UNION span, not the intersection.`;
      } else if (bugType === 1) {
        code = `function schedule_overlap(calA, calB) {
  const results = [];
  for (let i = 0; i < calA.length; i++) {
    for (let j = 0; j < calB.length; j++) {
      const overlapStart = Math.max(calA[i].start, calB[j].start);
      const overlapEnd = Math.min(calA[i].end, calB[j].end);
      const overlap = overlapEnd - overlapStart;
      if (overlap >= ${minOverlap}) {
        results.push({ slot_a_idx: i, slot_b_idx: j, overlap_minutes: overlap });
      }
    }
  }
  return results;
}`;
        bug = `Overlap threshold uses >= instead of >. Overlaps of exactly ${minOverlap} minutes should be excluded but are included.`;
      } else {
        code = `function schedule_overlap(calA, calB) {
  const results = [];
  for (let i = 0; i < calA.length; i++) {
    for (let j = 0; j < calB.length; j++) {
      const overlapStart = Math.max(calA[i].start, calB[j].start);
      const overlapEnd = Math.min(calA[i].end, calB[j].end);
      const overlap = overlapEnd - overlapStart;
      if (overlap > ${minOverlap}) {
        results.push({ slot_a_idx: i, slot_b_idx: j, overlap_minutes: overlap });
      }
    }
    break;
  }
  return results;
}`;
        bug = `Misplaced break statement exits the outer loop after processing only the first slot in calA. All subsequent calA slots are skipped.`;
      }

      const calA: Slot[] = [
        { start: 60 + Math.floor(rng() * 60), end: 180 + Math.floor(rng() * 60) },
        { start: 300 + Math.floor(rng() * 60), end: 420 + Math.floor(rng() * 60) },
        { start: 540 + Math.floor(rng() * 60), end: 660 + Math.floor(rng() * 60) },
      ];
      const calB: Slot[] = [
        { start: 120 + Math.floor(rng() * 60), end: 240 + Math.floor(rng() * 60) },
        { start: 360 + Math.floor(rng() * 60), end: 480 + Math.floor(rng() * 60) },
        { start: 600 + Math.floor(rng() * 30), end: 720 + Math.floor(rng() * 60) },
      ];

      return {
        code,
        bug_description: bug,
        testCases: [
          { input: { calendar_a: calA, calendar_b: calB }, expected_output: correct(calA, calB) },
          { input: { calendar_a: [{ start: 0, end: 100 }], calendar_b: [{ start: 50, end: 150 }] }, expected_output: correct([{ start: 0, end: 100 }], [{ start: 50, end: 150 }]) },
          { input: { calendar_a: [{ start: 0, end: 100 }], calendar_b: [{ start: 200, end: 300 }] }, expected_output: correct([{ start: 0, end: 100 }], [{ start: 200, end: 300 }]) },
          {
            input: {
              calendar_a: [{ start: 0, end: minOverlap + 10 }],
              calendar_b: [{ start: 10, end: 10 + minOverlap }],
            },
            expected_output: correct([{ start: 0, end: minOverlap + 10 }], [{ start: 10, end: 10 + minOverlap }]),
          },
          {
            input: {
              calendar_a: [{ start: 0, end: minOverlap + 11 }],
              calendar_b: [{ start: 10, end: 10 + minOverlap + 1 }],
            },
            expected_output: correct([{ start: 0, end: minOverlap + 11 }], [{ start: 10, end: 10 + minOverlap + 1 }]),
          },
          {
            input: {
              calendar_a: [{ start: 100, end: 160 }, { start: 300, end: 360 }],
              calendar_b: [{ start: 120, end: 180 }, { start: 330, end: 390 }],
            },
            expected_output: correct(
              [{ start: 100, end: 160 }, { start: 300, end: 360 }],
              [{ start: 120, end: 180 }, { start: 330, end: 390 }],
            ),
          },
        ],
        correctOutputs: [
          correct(calA, calB),
          correct([{ start: 0, end: 100 }], [{ start: 50, end: 150 }]),
          correct([{ start: 0, end: 100 }], [{ start: 200, end: 300 }]),
          correct([{ start: 0, end: minOverlap + 10 }], [{ start: 10, end: 10 + minOverlap }]),
          correct([{ start: 0, end: minOverlap + 11 }], [{ start: 10, end: 10 + minOverlap + 1 }]),
          correct(
            [{ start: 100, end: 160 }, { start: 300, end: 360 }],
            [{ start: 120, end: 180 }, { start: 330, end: 390 }],
          ),
        ],
      };
    },
  },
  {
    name: "water_bill",
    description: "Calculate a water bill using tiered usage rates. Usage up to tier1Limit liters costs rate1 cents/liter. Usage from tier1Limit to tier2Limit costs rate2 cents/liter. Usage above tier2Limit costs rate3 cents/liter. Add a fixed service charge. If usage is zero, only the service charge applies. Residential customers get residentialDiscount% off the usage charges (not the service charge). Return total in dollars (not cents), rounded to 2 decimal places.",
    makeBroken: (rng) => {
      const tier1Limit = 500 + Math.floor(rng() * 500);
      const tier2Limit = tier1Limit + 500 + Math.floor(rng() * 1000);
      const rate1 = 5 + Math.floor(rng() * 5);
      const rate2 = rate1 + 3 + Math.floor(rng() * 5);
      const rate3 = rate2 + 5 + Math.floor(rng() * 8);
      const serviceCharge = 10 + Math.floor(rng() * 15);
      const residentialDiscount = 5 + Math.floor(rng() * 15);
      const bugType = Math.floor(rng() * 3);

      const correct = (usage: number, isResidential: boolean) => {
        let usageCents = 0;
        if (usage <= tier1Limit) {
          usageCents = usage * rate1;
        } else if (usage <= tier2Limit) {
          usageCents = tier1Limit * rate1 + (usage - tier1Limit) * rate2;
        } else {
          usageCents = tier1Limit * rate1 + (tier2Limit - tier1Limit) * rate2 + (usage - tier2Limit) * rate3;
        }
        if (isResidential) usageCents *= (1 - residentialDiscount / 100);
        const totalDollars = (usageCents / 100) + serviceCharge;
        return Math.round(totalDollars * 100) / 100;
      };

      let code: string;
      let bug: string;

      if (bugType === 0) {
        code = `function water_bill(usage, isResidential) {
  let usageCents = 0;
  if (usage <= ${tier1Limit}) {
    usageCents = usage * ${rate1};
  } else if (usage <= ${tier2Limit}) {
    usageCents = ${tier1Limit} * ${rate1} + (usage - ${tier1Limit}) * ${rate2};
  } else {
    usageCents = ${tier1Limit} * ${rate1} + (${tier2Limit} - ${tier1Limit}) * ${rate2} + (usage - ${tier2Limit}) * ${rate3};
  }
  if (isResidential) usageCents *= (1 - ${residentialDiscount} / 100);
  const totalDollars = usageCents / 100 + ${serviceCharge};
  return Math.round(totalDollars * 100) / 100;
}`;
        bug = "No bug in this variant";
      } else if (bugType === 1) {
        code = `function water_bill(usage, isResidential) {
  let usageCents = 0;
  if (usage <= ${tier1Limit}) {
    usageCents = usage * ${rate1};
  } else if (usage <= ${tier2Limit}) {
    usageCents = usage * ${rate2};
  } else {
    usageCents = usage * ${rate3};
  }
  if (isResidential) usageCents *= (1 - ${residentialDiscount} / 100);
  const totalDollars = usageCents / 100 + ${serviceCharge};
  return Math.round(totalDollars * 100) / 100;
}`;
        bug = `Applies each tier's rate to total usage instead of marginally. Should apply rate1 to first ${tier1Limit}L, rate2 to amount between ${tier1Limit} and ${tier2Limit}, etc.`;
      } else {
        code = `function water_bill(usage, isResidential) {
  let usageCents = 0;
  if (usage <= ${tier1Limit}) {
    usageCents = usage * ${rate1};
  } else if (usage <= ${tier2Limit}) {
    usageCents = ${tier1Limit} * ${rate1} + (usage - ${tier1Limit}) * ${rate2};
  } else {
    usageCents = ${tier1Limit} * ${rate1} + (${tier2Limit} - ${tier1Limit}) * ${rate2} + (usage - ${tier2Limit}) * ${rate3};
  }
  let totalDollars = usageCents / 100 + ${serviceCharge};
  if (isResidential) totalDollars *= (1 - ${residentialDiscount} / 100);
  return Math.round(totalDollars * 100) / 100;
}`;
        bug = `Residential discount is applied to total (including service charge) instead of just usage charges. The discount should only apply to usageCents, not the service charge.`;
      }

      // Replace the no-bug variant
      if (bugType === 0) {
        code = `function water_bill(usage, isResidential) {
  let usageCents = 0;
  if (usage <= ${tier1Limit}) {
    usageCents = usage * ${rate1};
  } else if (usage <= ${tier2Limit}) {
    usageCents = ${tier1Limit} * ${rate1} + (usage - ${tier1Limit}) * ${rate2};
  } else {
    usageCents = ${tier1Limit} * ${rate1} + (${tier2Limit} - ${tier1Limit}) * ${rate2} + (usage - ${tier2Limit}) * ${rate3};
  }
  if (isResidential) usageCents *= (1 - ${residentialDiscount} / 100);
  const totalDollars = usageCents + ${serviceCharge};
  return Math.round(totalDollars * 100) / 100;
}`;
        bug = `Forgets to convert usageCents to dollars. Adds cents directly to the dollar-denominated service charge. Should be usageCents / 100 + ${serviceCharge}.`;
      }

      const cases = [
        { u: 0, r: false },
        { u: tier1Limit - 100, r: true },
        { u: tier1Limit - 1, r: false },
        { u: tier1Limit, r: false },
        { u: tier1Limit + 1, r: true },
        { u: tier1Limit + 200, r: true },
        { u: tier2Limit - 1, r: false },
        { u: tier2Limit, r: true },
        { u: tier2Limit + 1, r: false },
        { u: tier2Limit + 500, r: false },
        { u: tier2Limit + 500, r: true },
      ];

      return {
        code,
        bug_description: bug,
        testCases: cases.map(c => ({
          input: { usage: c.u, is_residential: c.r },
          expected_output: correct(c.u, c.r),
        })),
        correctOutputs: cases.map(c => correct(c.u, c.r)),
      };
    },
  },
];

export function generateRefactorData(seed: number): RefactorData {
  const rng = mulberry32(seed);

  const shuffled = [...templates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selected = shuffled.slice(0, 5);

  const functions: BrokenFunction[] = [];
  const truthFunctions: RefactorGroundTruth["functions"] = [];

  for (let i = 0; i < selected.length; i++) {
    const tmpl = selected[i];
    const result = tmpl.makeBroken(rng);
    const id = `fn-${seed}-${i}`;

    functions.push({
      id,
      name: tmpl.name,
      description: tmpl.description,
      language: "javascript",
      code: result.code,
      bug_description: result.bug_description,
      test_cases: result.testCases,
    });

    truthFunctions.push({
      id,
      correct_outputs: result.correctOutputs,
    });
  }

  const ids = functions.map(f => f.id);
  const objective =
    `Analyze 5 broken JavaScript functions and determine their correct outputs. Each function implements business logic with subtle edge-case bugs — read the code and description carefully, identify what's wrong, and submit exact typed outputs for every test case.\n\nExpected format: {"answer": {"${ids[0]}": [...], "${ids[1]}": [...], ...}}`;

  return {
    functions,
    groundTruth: { functions: truthFunctions },
    objective,
  };
}
