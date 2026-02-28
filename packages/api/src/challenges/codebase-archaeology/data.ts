import { mulberry32 } from "../../services/whimsy.js";

export interface ArchaeologyGroundTruth {
  buggy_commit_index: number;
  buggy_commit_message: string;
  bug_description: string;
  correct_function_body: string;
  function_name: string;
  file_path: string;
}

export interface ArchaeologyData {
  objective: string;
  groundTruth: ArchaeologyGroundTruth;
  files: Record<string, string>;
}

// Each template generates a multi-file project where the bug is subtle
// and requires understanding the code, not just recognizing a pattern.
interface ProjectTemplate {
  name: string;
  functionName: string;
  filePath: string;
  makeProject: (rng: () => number) => {
    files: Record<string, string>;
    buggyFile: string;
    correctFile: string;
    testFile: string;
    testPath: string;
    bugDesc: string;
  };
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: "invoice-processor",
    functionName: "calculateInvoiceTotal",
    filePath: "src/billing/invoice.ts",
    makeProject: (rng) => {
      const taxRate = 5 + Math.floor(rng() * 15);
      const lateFeePct = 2 + Math.floor(rng() * 5);
      const discountThreshold = 500 + Math.floor(rng() * 500);
      const bulkDiscountPct = 5 + Math.floor(rng() * 10);

      const correct = `export function calculateInvoiceTotal(
  items: Array<{ unitPrice: number; quantity: number; taxable: boolean }>,
  daysOverdue: number,
  couponPct: number
): { subtotal: number; tax: number; discount: number; lateFee: number; total: number } {
  let subtotal = 0;
  let taxableSubtotal = 0;
  for (const item of items) {
    const lineTotal = item.unitPrice * item.quantity;
    subtotal += lineTotal;
    if (item.taxable) taxableSubtotal += lineTotal;
  }

  const discount = subtotal >= ${discountThreshold}
    ? subtotal * ${bulkDiscountPct} / 100 + subtotal * couponPct / 100
    : subtotal * couponPct / 100;

  const afterDiscount = subtotal - discount;
  const taxableAfterDiscount = taxableSubtotal * (afterDiscount / subtotal || 0);
  const tax = Math.round(taxableAfterDiscount * ${taxRate} / 100 * 100) / 100;
  const lateFee = daysOverdue > 0 ? Math.round(afterDiscount * ${lateFeePct} / 100 * daysOverdue * 100) / 100 : 0;
  const total = Math.round((afterDiscount + tax + lateFee) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax,
    discount: Math.round(discount * 100) / 100,
    lateFee,
    total,
  };
}`;

      const bugType = Math.floor(rng() * 3);
      let buggy: string;
      let bugDesc: string;

      if (bugType === 0) {
        buggy = correct.replace(
          `const taxableAfterDiscount = taxableSubtotal * (afterDiscount / subtotal || 0);`,
          `const taxableAfterDiscount = taxableSubtotal;`
        );
        bugDesc = "Tax is calculated on the full taxable subtotal instead of the proportionally reduced amount after discounts. The discount should reduce the taxable base proportionally.";
      } else if (bugType === 1) {
        buggy = correct.replace(
          `? subtotal * ${bulkDiscountPct} / 100 + subtotal * couponPct / 100`,
          `? subtotal * (${bulkDiscountPct} + couponPct) / 100`
        );
        bugDesc = `Bulk discount and coupon are combined before applying to subtotal. While mathematically equivalent for percentages, the actual bug is different: replaced correct line. Actually this IS equivalent. Let me use a real bug.`;
        // That's equivalent, use a different bug
        buggy = correct.replace(
          `const lateFee = daysOverdue > 0 ? Math.round(afterDiscount * ${lateFeePct} / 100 * daysOverdue * 100) / 100 : 0;`,
          `const lateFee = daysOverdue > 0 ? Math.round(subtotal * ${lateFeePct} / 100 * daysOverdue * 100) / 100 : 0;`
        );
        bugDesc = `Late fee is calculated on the original subtotal instead of the discounted amount (afterDiscount). This overcharges late fees when discounts are applied.`;
      } else {
        buggy = correct.replace(
          `const discount = subtotal >= ${discountThreshold}`,
          `const discount = subtotal > ${discountThreshold}`
        );
        bugDesc = `Bulk discount threshold uses > instead of >=. Orders exactly at $${discountThreshold} should qualify for the bulk discount but don't.`;
      }

      const files: Record<string, string> = {};
      files["src/billing/invoice.ts"] = buggy;
      files["src/billing/formatter.ts"] = `import type { calculateInvoiceTotal } from "./invoice";

type InvoiceResult = ReturnType<typeof calculateInvoiceTotal>;

export function formatInvoice(result: InvoiceResult): string {
  const lines = [
    \`Subtotal: $\${result.subtotal.toFixed(2)}\`,
    \`Discount: -$\${result.discount.toFixed(2)}\`,
    \`Tax (${taxRate}%): $\${result.tax.toFixed(2)}\`,
  ];
  if (result.lateFee > 0) {
    lines.push(\`Late Fee: $\${result.lateFee.toFixed(2)}\`);
  }
  lines.push(\`Total: $\${result.total.toFixed(2)}\`);
  return lines.join("\\n");
}`;
      files["src/billing/index.ts"] = `export { calculateInvoiceTotal } from "./invoice";
export { formatInvoice } from "./formatter";`;
      files["src/utils/math.ts"] = `export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function percentOf(amount: number, pct: number): number {
  return amount * pct / 100;
}`;
      files["src/utils/validation.ts"] = `export function validatePositive(value: number, name: string): void {
  if (value < 0) throw new Error(\`\${name} must be non-negative, got \${value}\`);
}

export function validateRange(value: number, min: number, max: number, name: string): void {
  if (value < min || value > max) throw new Error(\`\${name} must be between \${min} and \${max}\`);
}`;
      files["src/config.ts"] = `export const BILLING_CONFIG = {
  taxRate: ${taxRate},
  lateFeePctPerDay: ${lateFeePct},
  bulkDiscountThreshold: ${discountThreshold},
  bulkDiscountPct: ${bulkDiscountPct},
  maxCouponPct: 30,
  currency: "USD",
};`;

      const testFile = `import { calculateInvoiceTotal } from "../src/billing/invoice";

describe("calculateInvoiceTotal", () => {
  const taxableItems = [
    { unitPrice: 100, quantity: 2, taxable: true },
    { unitPrice: 50, quantity: 3, taxable: true },
  ];
  const mixedItems = [
    { unitPrice: 200, quantity: 1, taxable: true },
    { unitPrice: 80, quantity: 2, taxable: false },
  ];

  test("basic invoice no discount no late fee", () => {
    const result = calculateInvoiceTotal(
      [{ unitPrice: 100, quantity: 1, taxable: true }], 0, 0
    );
    expect(result.subtotal).toBe(100);
    expect(result.discount).toBe(0);
    expect(result.tax).toBe(${taxRate});
    expect(result.lateFee).toBe(0);
    expect(result.total).toBe(${100 + taxRate});
  });

  test("bulk discount applies at threshold", () => {
    const result = calculateInvoiceTotal(taxableItems, 0, 0);
    expect(result.subtotal).toBe(350);
    ${350 >= discountThreshold ?
        `expect(result.discount).toBe(${Math.round(350 * bulkDiscountPct) / 100});` :
        `expect(result.discount).toBe(0);`}
  });

  test("late fee calculated on discounted amount", () => {
    const result = calculateInvoiceTotal(taxableItems, 3, 5);
    expect(result.lateFee).toBeGreaterThan(0);
    const afterDiscount = result.subtotal - result.discount;
    const expectedFee = Math.round(afterDiscount * ${lateFeePct} / 100 * 3 * 100) / 100;
    expect(result.lateFee).toBe(expectedFee);
  });

  test("mixed taxable and non-taxable items", () => {
    const result = calculateInvoiceTotal(mixedItems, 0, 0);
    expect(result.subtotal).toBe(360);
  });

  test("coupon applied to all items", () => {
    const result = calculateInvoiceTotal(
      [{ unitPrice: 200, quantity: 1, taxable: true }], 0, 10
    );
    expect(result.discount).toBe(20);
  });
});`;

      return {
        files,
        buggyFile: buggy,
        correctFile: correct,
        testFile,
        testPath: "tests/billing.test.ts",
        bugDesc: bugDesc,
      };
    },
  },
  {
    name: "scheduling-engine",
    functionName: "findAvailableSlots",
    filePath: "src/scheduler/availability.ts",
    makeProject: (rng) => {
      const minSlotMinutes = 15 + Math.floor(rng() * 3) * 15;
      const bufferMinutes = 5 + Math.floor(rng() * 4) * 5;
      const maxSlotsPerDay = 6 + Math.floor(rng() * 6);

      const correct = `export interface TimeSlot {
  start: number;  // minutes from midnight
  end: number;
}

export function findAvailableSlots(
  busySlots: TimeSlot[],
  dayStart: number,
  dayEnd: number,
  duration: number,
  buffer: number
): TimeSlot[] {
  const sorted = [...busySlots].sort((a, b) => a.start - b.start);

  const merged: TimeSlot[] = [];
  for (const slot of sorted) {
    const buffered = { start: slot.start - buffer, end: slot.end + buffer };
    if (merged.length > 0 && buffered.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, buffered.end);
    } else {
      merged.push({ ...buffered });
    }
  }

  const available: TimeSlot[] = [];
  let cursor = dayStart;

  for (const busy of merged) {
    if (cursor + duration <= busy.start) {
      available.push({ start: cursor, end: busy.start });
    }
    cursor = Math.max(cursor, busy.end);
  }

  if (cursor + duration <= dayEnd) {
    available.push({ start: cursor, end: dayEnd });
  }

  return available.slice(0, ${maxSlotsPerDay});
}`;

      const bugType = Math.floor(rng() * 3);
      let buggy: string;
      let bugDesc: string;

      if (bugType === 0) {
        buggy = correct.replace(
          `const buffered = { start: slot.start - buffer, end: slot.end + buffer };`,
          `const buffered = { start: slot.start - buffer, end: slot.end };`
        );
        bugDesc = `Buffer is only applied before busy slots, not after. The end of each busy slot should also have a buffer added, but it's missing. This causes available slots to start too early after meetings.`;
      } else if (bugType === 1) {
        buggy = correct.replace(
          `if (cursor + duration <= busy.start) {`,
          `if (cursor + duration < busy.start) {`
        );
        bugDesc = `Available slot check uses < instead of <=. A gap exactly equal to the requested duration should be included but is excluded.`;
      } else {
        buggy = correct.replace(
          `const sorted = [...busySlots].sort((a, b) => a.start - b.start);`,
          `const sorted = busySlots.sort((a, b) => a.start - b.start);`
        );
        bugDesc = `Sorts the input array in-place instead of creating a copy. This mutates the caller's data, causing subsequent calls with the same array to see different ordering.`;
      }

      const files: Record<string, string> = {};
      files["src/scheduler/availability.ts"] = buggy;
      files["src/scheduler/booking.ts"] = `import type { TimeSlot } from "./availability";

export interface Booking {
  id: string;
  slot: TimeSlot;
  attendees: string[];
}

export function createBooking(slot: TimeSlot, attendees: string[]): Booking {
  return {
    id: \`bk-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`,
    slot,
    attendees,
  };
}

export function isConflict(existing: Booking[], newSlot: TimeSlot): boolean {
  return existing.some(b =>
    newSlot.start < b.slot.end && newSlot.end > b.slot.start
  );
}`;
      files["src/scheduler/index.ts"] = `export { findAvailableSlots } from "./availability";
export type { TimeSlot } from "./availability";
export { createBooking, isConflict } from "./booking";`;
      files["src/utils/time.ts"] = `export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return \`\${String(h).padStart(2, "0")}:\${String(m).padStart(2, "0")}\`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}`;
      files["src/config.ts"] = `export const SCHEDULER_CONFIG = {
  minSlotMinutes: ${minSlotMinutes},
  bufferMinutes: ${bufferMinutes},
  maxSlotsPerDay: ${maxSlotsPerDay},
  workdayStart: 540,  // 09:00
  workdayEnd: 1020,   // 17:00
};`;

      const testFile = `import { findAvailableSlots, TimeSlot } from "../src/scheduler/availability";

describe("findAvailableSlots", () => {
  const dayStart = 540;  // 09:00
  const dayEnd = 1020;   // 17:00
  const buffer = ${bufferMinutes};
  const duration = ${minSlotMinutes};

  test("no busy slots returns full day", () => {
    const result = findAvailableSlots([], dayStart, dayEnd, duration, buffer);
    expect(result).toEqual([{ start: dayStart, end: dayEnd }]);
  });

  test("single busy slot creates two gaps", () => {
    const busy = [{ start: 660, end: 720 }]; // 11:00-12:00
    const result = findAvailableSlots(busy, dayStart, dayEnd, duration, buffer);
    expect(result[0].end).toBe(660 - buffer);
    expect(result[1].start).toBe(720 + buffer);
  });

  test("buffer prevents slots too close to meetings", () => {
    const busy = [{ start: 600, end: 630 }];
    const result = findAvailableSlots(busy, dayStart, dayEnd, duration, buffer);
    for (const slot of result) {
      expect(slot.start).not.toBeGreaterThanOrEqual(600 - buffer);
      expect(slot.start).not.toBeLessThan(630 + buffer);
    }
  });

  test("does not mutate input array", () => {
    const busy: TimeSlot[] = [
      { start: 780, end: 810 },
      { start: 600, end: 630 },
    ];
    const original = JSON.parse(JSON.stringify(busy));
    findAvailableSlots(busy, dayStart, dayEnd, duration, buffer);
    expect(busy).toEqual(original);
  });

  test("exact fit slot is included", () => {
    const gapStart = dayStart;
    const gapEnd = gapStart + duration;
    const busy = [{ start: gapEnd, end: gapEnd + 60 }];
    const result = findAvailableSlots(busy, dayStart, dayEnd, duration, buffer);
    const firstSlot = result[0];
    expect(firstSlot.start).toBeLessThanOrEqual(gapStart);
  });
});`;

      return {
        files,
        buggyFile: buggy,
        correctFile: correct,
        testFile,
        testPath: "tests/scheduler.test.ts",
        bugDesc,
      };
    },
  },
  {
    name: "data-pipeline",
    functionName: "aggregateMetrics",
    filePath: "src/pipeline/aggregator.ts",
    makeProject: (rng) => {
      const topN = 3 + Math.floor(rng() * 5);
      const outlierMultiplier = 2 + Math.floor(rng() * 3);
      const minSampleSize = 3 + Math.floor(rng() * 5);

      const correct = `export interface DataPoint {
  source: string;
  timestamp: number;
  value: number;
  category: string;
}

export interface AggregateResult {
  category: string;
  mean: number;
  median: number;
  stddev: number;
  count: number;
  outlierCount: number;
}

export function aggregateMetrics(
  data: DataPoint[],
  outlierThreshold: number,
  minSamples: number
): AggregateResult[] {
  const grouped = new Map<string, number[]>();
  for (const dp of data) {
    if (!grouped.has(dp.category)) grouped.set(dp.category, []);
    grouped.get(dp.category)!.push(dp.value);
  }

  const results: AggregateResult[] = [];

  for (const [category, values] of grouped) {
    if (values.length < minSamples) continue;

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;

    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);

    const outlierCount = values.filter(v => Math.abs(v - mean) > outlierThreshold * stddev).length;

    results.push({
      category,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stddev: Math.round(stddev * 100) / 100,
      count: values.length,
      outlierCount,
    });
  }

  return results.sort((a, b) => b.count - a.count);
}`;

      const bugType = Math.floor(rng() * 3);
      let buggy: string;
      let bugDesc: string;

      if (bugType === 0) {
        buggy = correct.replace(
          `const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;`,
          `const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);`
        );
        bugDesc = `Uses Bessel's correction (n-1) for variance instead of population variance (n). The specification says to compute population standard deviation, not sample standard deviation.`;
      } else if (bugType === 1) {
        buggy = correct.replace(
          `const median = sorted.length % 2 === 0\n      ? (sorted[mid - 1] + sorted[mid]) / 2\n      : sorted[mid];`,
          `const median = sorted.length % 2 === 0\n      ? (sorted[mid] + sorted[mid + 1]) / 2\n      : sorted[mid];`
        );
        bugDesc = `Median calculation for even-length arrays uses indices mid and mid+1 instead of mid-1 and mid. For a 4-element array, it averages elements at indices 2 and 3 instead of 1 and 2.`;
      } else {
        buggy = correct.replace(
          `return results.sort((a, b) => b.count - a.count);`,
          `return results.sort((a, b) => a.count - b.count);`
        );
        bugDesc = `Results are sorted in ascending order by count instead of descending. The specification says to return categories with the most data points first.`;
      }

      const files: Record<string, string> = {};
      files["src/pipeline/aggregator.ts"] = buggy;
      files["src/pipeline/filter.ts"] = `import type { DataPoint } from "./aggregator";

export function filterByTimeRange(data: DataPoint[], start: number, end: number): DataPoint[] {
  return data.filter(d => d.timestamp >= start && d.timestamp <= end);
}

export function filterBySource(data: DataPoint[], sources: string[]): DataPoint[] {
  const sourceSet = new Set(sources);
  return data.filter(d => sourceSet.has(d.source));
}`;
      files["src/pipeline/transform.ts"] = `import type { DataPoint } from "./aggregator";

export function normalizeValues(data: DataPoint[]): DataPoint[] {
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return data.map(d => ({ ...d, value: (d.value - min) / range }));
}

export function deduplicateByTimestamp(data: DataPoint[]): DataPoint[] {
  const seen = new Map<string, DataPoint>();
  for (const d of data) {
    const key = \`\${d.source}:\${d.timestamp}\`;
    if (!seen.has(key) || d.timestamp > seen.get(key)!.timestamp) {
      seen.set(key, d);
    }
  }
  return Array.from(seen.values());
}`;
      files["src/pipeline/index.ts"] = `export { aggregateMetrics } from "./aggregator";
export type { DataPoint, AggregateResult } from "./aggregator";
export { filterByTimeRange, filterBySource } from "./filter";
export { normalizeValues, deduplicateByTimestamp } from "./transform";`;
      files["src/config.ts"] = `export const PIPELINE_CONFIG = {
  topN: ${topN},
  outlierMultiplier: ${outlierMultiplier},
  minSampleSize: ${minSampleSize},
  defaultTimeWindow: 86400,
};`;

      const testFile = `import { aggregateMetrics, DataPoint } from "../src/pipeline/aggregator";

describe("aggregateMetrics", () => {
  const sampleData: DataPoint[] = [
    { source: "A", timestamp: 1, value: 10, category: "cpu" },
    { source: "A", timestamp: 2, value: 20, category: "cpu" },
    { source: "A", timestamp: 3, value: 30, category: "cpu" },
    { source: "A", timestamp: 4, value: 40, category: "cpu" },
    { source: "B", timestamp: 1, value: 5, category: "mem" },
    { source: "B", timestamp: 2, value: 15, category: "mem" },
    { source: "B", timestamp: 3, value: 25, category: "mem" },
    { source: "B", timestamp: 4, value: 35, category: "mem" },
    { source: "B", timestamp: 5, value: 45, category: "mem" },
  ];

  test("computes population standard deviation", () => {
    const result = aggregateMetrics(sampleData, 2, 3);
    const cpuResult = result.find(r => r.category === "cpu");
    // population stddev of [10,20,30,40] = sqrt(mean of squared diffs)
    // mean = 25, diffs = [-15,-5,5,15], sq = [225,25,25,225], mean = 125, sqrt = 11.18
    expect(cpuResult!.stddev).toBeCloseTo(11.18, 1);
  });

  test("computes median correctly for even count", () => {
    const result = aggregateMetrics(sampleData, 2, 3);
    const cpuResult = result.find(r => r.category === "cpu");
    // sorted [10,20,30,40], mid=2, median = (sorted[1]+sorted[2])/2 = (20+30)/2 = 25
    expect(cpuResult!.median).toBe(25);
  });

  test("results sorted by count descending", () => {
    const result = aggregateMetrics(sampleData, 2, 3);
    expect(result[0].count).toBeGreaterThanOrEqual(result[result.length - 1].count);
  });

  test("filters categories below min samples", () => {
    const small: DataPoint[] = [
      { source: "A", timestamp: 1, value: 10, category: "tiny" },
    ];
    const result = aggregateMetrics([...sampleData, ...small], 2, 3);
    expect(result.find(r => r.category === "tiny")).toBeUndefined();
  });

  test("counts outliers correctly", () => {
    const withOutlier: DataPoint[] = [
      ...sampleData,
      { source: "A", timestamp: 5, value: 500, category: "cpu" },
    ];
    const result = aggregateMetrics(withOutlier, 2, 3);
    const cpuResult = result.find(r => r.category === "cpu");
    expect(cpuResult!.outlierCount).toBeGreaterThanOrEqual(1);
  });
});`;

      return {
        files,
        buggyFile: buggy,
        correctFile: correct,
        testFile,
        testPath: "tests/pipeline.test.ts",
        bugDesc,
      };
    },
  },
  {
    name: "permission-checker",
    functionName: "evaluateAccess",
    filePath: "src/auth/permissions.ts",
    makeProject: (rng) => {
      const maxRoleDepth = 3 + Math.floor(rng() * 3);
      const denyPriority = rng() > 0.5;

      const correct = `export interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];
}

export interface AccessRequest {
  user: string;
  resource: string;
  action: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedRule: string | null;
}

export function evaluateAccess(
  request: AccessRequest,
  userRoles: string[],
  roleDefinitions: Map<string, Role>,
  denyRules: string[],
  maxDepth: number
): AccessDecision {
  const permission = \`\${request.resource}:\${request.action}\`;
  const wildcard = \`\${request.resource}:*\`;

  // Check deny rules first (deny takes priority)
  for (const role of userRoles) {
    const allPerms = resolvePermissions(role, roleDefinitions, maxDepth, new Set());
    for (const perm of allPerms) {
      if (denyRules.includes(perm) && (perm === permission || perm === wildcard)) {
        return { allowed: false, reason: "Explicitly denied", matchedRule: perm };
      }
    }
  }

  // Check allow rules
  for (const role of userRoles) {
    const allPerms = resolvePermissions(role, roleDefinitions, maxDepth, new Set());
    if (allPerms.has(permission) || allPerms.has(wildcard)) {
      return { allowed: true, reason: "Permission granted via role", matchedRule: permission };
    }
  }

  return { allowed: false, reason: "No matching permission", matchedRule: null };
}

function resolvePermissions(
  roleName: string,
  definitions: Map<string, Role>,
  maxDepth: number,
  visited: Set<string>
): Set<string> {
  if (maxDepth <= 0 || visited.has(roleName)) return new Set();
  visited.add(roleName);

  const role = definitions.get(roleName);
  if (!role) return new Set();

  const perms = new Set(role.permissions);
  if (role.inherits) {
    for (const parent of role.inherits) {
      const parentPerms = resolvePermissions(parent, definitions, maxDepth - 1, visited);
      for (const p of parentPerms) perms.add(p);
    }
  }
  return perms;
}`;

      const bugType = Math.floor(rng() * 3);
      let buggy: string;
      let bugDesc: string;

      if (bugType === 0) {
        buggy = correct.replace(
          `if (maxDepth <= 0 || visited.has(roleName)) return new Set();`,
          `if (maxDepth < 0 || visited.has(roleName)) return new Set();`
        );
        bugDesc = `resolvePermissions uses maxDepth < 0 instead of maxDepth <= 0. This allows one extra level of recursion beyond the specified max depth.`;
      } else if (bugType === 1) {
        buggy = correct.replace(
          `const allPerms = resolvePermissions(role, roleDefinitions, maxDepth, new Set());
    if (allPerms.has(permission) || allPerms.has(wildcard)) {`,
          `const allPerms = resolvePermissions(role, roleDefinitions, maxDepth, new Set());
    if (allPerms.has(permission)) {`
        );
        bugDesc = `Wildcard permission check is missing from the allow rules. A role with "resource:*" should grant access to any action on that resource, but only exact permission matches are checked.`;
      } else {
        buggy = correct.replace(
          `for (const parent of role.inherits) {
      const parentPerms = resolvePermissions(parent, definitions, maxDepth - 1, visited);`,
          `for (const parent of role.inherits) {
      const parentPerms = resolvePermissions(parent, definitions, maxDepth - 1, new Set());`
        );
        bugDesc = `Creates a new visited set for each parent role instead of sharing the visited set. This defeats the cycle detection and can cause infinite recursion with circular role inheritance.`;
      }

      const files: Record<string, string> = {};
      files["src/auth/permissions.ts"] = buggy;
      files["src/auth/session.ts"] = `export interface Session {
  userId: string;
  roles: string[];
  expiresAt: number;
}

export function isSessionValid(session: Session): boolean {
  return session.expiresAt > Date.now();
}

export function hasRole(session: Session, role: string): boolean {
  return session.roles.includes(role);
}`;
      files["src/auth/index.ts"] = `export { evaluateAccess } from "./permissions";
export type { Role, AccessRequest, AccessDecision } from "./permissions";
export { isSessionValid, hasRole } from "./session";`;
      files["src/middleware/guard.ts"] = `import { evaluateAccess, AccessRequest, Role } from "../auth/permissions";

export function createGuard(roleDefinitions: Map<string, Role>, denyRules: string[], maxDepth: number) {
  return function guard(userRoles: string[], resource: string, action: string): boolean {
    const request: AccessRequest = { user: "system", resource, action };
    const decision = evaluateAccess(request, userRoles, roleDefinitions, denyRules, maxDepth);
    return decision.allowed;
  };
}`;
      files["src/config.ts"] = `export const AUTH_CONFIG = {
  maxRoleInheritanceDepth: ${maxRoleDepth},
  sessionTimeoutMs: 3600000,
  denyTakesPriority: ${denyPriority},
};`;

      const testFile = `import { evaluateAccess, Role } from "../src/auth/permissions";

describe("evaluateAccess", () => {
  const roles = new Map<string, Role>([
    ["viewer", { name: "viewer", permissions: ["docs:read", "docs:list"] }],
    ["editor", { name: "editor", permissions: ["docs:write", "docs:delete"], inherits: ["viewer"] }],
    ["admin", { name: "admin", permissions: ["users:*", "settings:*"], inherits: ["editor"] }],
  ]);

  test("direct permission grants access", () => {
    const result = evaluateAccess(
      { user: "u1", resource: "docs", action: "read" },
      ["viewer"], roles, [], ${maxRoleDepth}
    );
    expect(result.allowed).toBe(true);
  });

  test("inherited permission grants access", () => {
    const result = evaluateAccess(
      { user: "u1", resource: "docs", action: "read" },
      ["editor"], roles, [], ${maxRoleDepth}
    );
    expect(result.allowed).toBe(true);
  });

  test("wildcard permission grants any action", () => {
    const result = evaluateAccess(
      { user: "u1", resource: "users", action: "delete" },
      ["admin"], roles, [], ${maxRoleDepth}
    );
    expect(result.allowed).toBe(true);
  });

  test("max depth limits inheritance resolution", () => {
    const result = evaluateAccess(
      { user: "u1", resource: "docs", action: "read" },
      ["admin"], roles, [], 1 // only 1 level deep: admin -> editor, but not -> viewer
    );
    // admin has no docs:read directly, editor has no docs:read directly
    // viewer has it but that's 2 levels deep
    expect(result.allowed).toBe(false);
  });

  test("deny rules override allow", () => {
    const result = evaluateAccess(
      { user: "u1", resource: "docs", action: "delete" },
      ["editor"], roles, ["docs:delete"], ${maxRoleDepth}
    );
    expect(result.allowed).toBe(false);
  });
});`;

      return {
        files,
        buggyFile: buggy,
        correctFile: correct,
        testFile,
        testPath: "tests/permissions.test.ts",
        bugDesc,
      };
    },
  },
];

const COMMIT_MESSAGES_INNOCENT = [
  "Add initial project scaffolding",
  "Set up TypeScript and build configuration",
  "Add utility helper functions",
  "Update README with API documentation",
  "Refactor module imports for consistency",
  "Add input validation layer",
  "Improve error messages and logging",
  "Add comprehensive type definitions",
  "Clean up code formatting",
  "Update development dependencies",
  "Add structured logging support",
  "Fix typo in documentation comments",
  "Optimize hot path performance",
  "Add configuration file support",
  "Restructure source directory layout",
  "Add environment variable handling",
  "Extract shared constants to config",
  "Simplify async error handling",
  "Add retry logic for network calls",
  "Improve test coverage for edge cases",
];

export function generateArchaeologyData(seed: number): ArchaeologyData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const template = pick(PROJECT_TEMPLATES);
  const project = template.makeProject(rng);

  const totalCommits = randInt(15, 22);
  const buggyCommitIndex = randInt(4, totalCommits - 4);

  const shuffledMsgs = [...COMMIT_MESSAGES_INNOCENT];
  for (let i = shuffledMsgs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledMsgs[i], shuffledMsgs[j]] = [shuffledMsgs[j], shuffledMsgs[i]];
  }

  const buggyCommitMsg = pick([
    `Refactor ${template.functionName} for clarity`,
    `Simplify ${template.functionName} implementation`,
    `Optimize ${template.functionName} edge cases`,
    `Clean up ${template.functionName} logic`,
  ]);

  const commits: Array<{ hash: string; index: number; message: string; files: string[] }> = [];
  for (let i = 0; i < totalCommits; i++) {
    const hashSeed = mulberry32(seed + i * 7919);
    const hash = Array.from({ length: 8 }, () =>
      "0123456789abcdef"[Math.floor(hashSeed() * 16)]
    ).join("");

    if (i === buggyCommitIndex) {
      commits.push({ hash, index: i, message: buggyCommitMsg, files: [template.filePath] });
    } else {
      const msg = shuffledMsgs[i % shuffledMsgs.length];
      // Some commits also touch the buggy file (red herrings)
      const touchesBuggyFile = rng() < 0.2;
      const otherFiles = Object.keys(project.files).filter(f => f !== template.filePath && !f.startsWith("tests/"));
      const touchedFiles = [pick(otherFiles)];
      if (touchesBuggyFile) touchedFiles.push(template.filePath);
      commits.push({ hash, index: i, message: msg, files: touchedFiles });
    }
  }

  const gitLog = [...commits].reverse().map((c, displayIdx) => {
    const daysAgo = displayIdx;
    return `commit ${c.hash}\nDate: ${daysAgo} days ago\nFiles: ${c.files.join(", ")}\n\n    ${c.message}\n`;
  }).join("\n");

  const files: Record<string, string> = { ...project.files };
  files[project.testPath] = project.testFile;
  files["GIT_LOG.txt"] = gitLog;

  // No diffs for the buggy commit -- agent must read code + tests
  files["COMMIT_HISTORY.md"] = `# Commit History

Total commits: ${totalCommits}

## Commits (newest first)

${[...commits].reverse().map(c =>
    `- \`${c.hash}\` ${c.message} — *${c.files.join(", ")}*`
  ).join("\n")}

## Commits that modified \`${template.filePath}\`

${commits
    .filter(c => c.files.includes(template.filePath))
    .map(c => `- \`${c.hash}\` ${c.message}`)
    .join("\n")}

**Note:** No diffs are available. Read the source code and failing tests to identify the regression.
`;

  const objective = `A regression was reported: \`${template.functionName}()\` in \`${template.filePath}\` is producing incorrect results. ` +
    `The test suite in \`${project.testPath}\` has failing tests. No diffs are available. ` +
    `Review the commit history, read the source code and tests, find the commit that introduced the bug, fix the code, and explain the root cause.`;

  return {
    objective,
    groundTruth: {
      buggy_commit_index: buggyCommitIndex,
      buggy_commit_message: buggyCommitMsg,
      bug_description: project.bugDesc,
      correct_function_body: project.correctFile,
      function_name: template.functionName,
      file_path: template.filePath,
    },
    files,
  };
}
