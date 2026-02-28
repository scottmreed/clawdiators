import { mulberry32 } from "../../services/whimsy.js";

export interface OptimizerGroundTruth {
  optimal_approach: string;
  optimal_complexity: string;
  optimizations: string[];
  function_name: string;
  file_path: string;
}

export interface OptimizerData {
  objective: string;
  groundTruth: OptimizerGroundTruth;
  files: Record<string, string>;
}

interface ProblemTemplate {
  name: string;
  file: string;
  description: string;
  slowCode: string;
  helperFiles: Record<string, string>;
  benchmarkCode: string;
  testCode: string;
  optimalApproach: string;
  optimalComplexity: string;
  optimizations: string[];
}

function generateProblems(rng: () => number): ProblemTemplate[] {
  const arraySize = 8000 + Math.floor(rng() * 5000);
  const threshold = 50 + Math.floor(rng() * 50);

  return [
    {
      name: "buildReport",
      file: "src/report-builder.ts",
      description: "Build a text report from transaction data with summaries",
      slowCode: `import { formatCurrency, formatDate } from "./formatters";
import { TransactionRecord, CategorySummary } from "./types";

// Build a formatted report string from transaction data.
// Groups transactions by category, computes subtotals, and returns
// a multi-line report string with per-category summaries.
export function buildReport(transactions: TransactionRecord[]): string {
  let report = "=== Transaction Report ===\\n\\n";

  // Get unique categories
  const categories: string[] = [];
  for (const tx of transactions) {
    if (!categories.includes(tx.category)) {
      categories.push(tx.category);
    }
  }

  for (const cat of categories) {
    report += \`Category: \${cat}\\n\`;
    report += "-".repeat(40) + "\\n";

    // Find all transactions for this category
    const catTransactions = transactions.filter(t => t.category === cat);

    let subtotal = 0;
    for (const tx of catTransactions) {
      // Format each transaction line
      const line = \`  \${formatDate(tx.timestamp)} | \${tx.description.padEnd(30)} | \${formatCurrency(tx.amount)}\\n\`;
      report += line;
      subtotal += tx.amount;

      // Check if this transaction is flagged
      if (isAboveThreshold(transactions, tx, ${threshold})) {
        report += \`  *** FLAGGED: amount exceeds category median by \${${threshold}}% ***\\n\`;
      }
    }

    report += \`  Subtotal: \${formatCurrency(subtotal)}\\n\\n\`;
  }

  report += "=== End Report ===\\n";
  return report;
}

// Check if a single transaction's amount exceeds the category median by threshold%.
// Recomputes the category median from scratch each time.
function isAboveThreshold(all: TransactionRecord[], tx: TransactionRecord, thresholdPct: number): boolean {
  const categoryAmounts = all
    .filter(t => t.category === tx.category)
    .map(t => t.amount)
    .sort((a, b) => a - b);

  const mid = Math.floor(categoryAmounts.length / 2);
  const median = categoryAmounts.length % 2 === 0
    ? (categoryAmounts[mid - 1] + categoryAmounts[mid]) / 2
    : categoryAmounts[mid];

  return tx.amount > median * (1 + thresholdPct / 100);
}`,
      helperFiles: {
        "src/formatters.ts": `export function formatCurrency(amount: number): string {
  return "$" + amount.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toISOString().slice(0, 10);
}`,
        "src/types.ts": `export interface TransactionRecord {
  id: string;
  category: string;
  description: string;
  amount: number;
  timestamp: number;
}

export interface CategorySummary {
  category: string;
  count: number;
  subtotal: number;
  median: number;
}`,
      },
      benchmarkCode: `import { buildReport } from "./report-builder";
import { TransactionRecord } from "./types";

const SIZE = ${arraySize};
const categories = ["food", "transport", "utilities", "entertainment", "health", "education"];
const transactions: TransactionRecord[] = Array.from({ length: SIZE }, (_, i) => ({
  id: \`tx-\${i}\`,
  category: categories[i % categories.length],
  description: \`Transaction item \${i}\`,
  amount: Math.random() * 500 + 10,
  timestamp: Date.now() - Math.random() * 86400000 * 365,
}));

console.log("Benchmarking buildReport with", SIZE, "transactions...");
const start = performance.now();
const report = buildReport(transactions);
const elapsed = performance.now() - start;

console.log(\`Report length: \${report.length} chars\`);
console.log(\`Time: \${elapsed.toFixed(2)}ms\`);`,
      testCode: `import { buildReport } from "./report-builder";
import { TransactionRecord } from "./types";

const sampleData: TransactionRecord[] = [
  { id: "1", category: "food", description: "Lunch", amount: 15, timestamp: 1700000000000 },
  { id: "2", category: "food", description: "Dinner", amount: 45, timestamp: 1700100000000 },
  { id: "3", category: "transport", description: "Bus", amount: 3, timestamp: 1700200000000 },
  { id: "4", category: "food", description: "Snack", amount: 8, timestamp: 1700300000000 },
  { id: "5", category: "transport", description: "Taxi", amount: 25, timestamp: 1700400000000 },
];

describe("buildReport", () => {
  test("includes all categories", () => {
    const report = buildReport(sampleData);
    expect(report).toContain("Category: food");
    expect(report).toContain("Category: transport");
  });
  test("includes subtotals", () => {
    const report = buildReport(sampleData);
    expect(report).toContain("Subtotal:");
  });
  test("includes header and footer", () => {
    const report = buildReport(sampleData);
    expect(report).toContain("=== Transaction Report ===");
    expect(report).toContain("=== End Report ===");
  });
  test("handles empty input", () => {
    const report = buildReport([]);
    expect(report).toContain("=== Transaction Report ===");
  });
});`,
      optimalApproach: "Three bottlenecks: (1) string concatenation in loop -- use array.join(), (2) isAboveThreshold recomputes category median from scratch for EVERY transaction -- precompute medians once, (3) categories.includes() is O(n) -- use a Set. The dominant bottleneck is the repeated median recomputation which is O(n^2 log n).",
      optimalComplexity: "O(n log n) with precomputed medians and array.join() for string building",
      optimizations: [
        "Precompute category medians once instead of recomputing per transaction",
        "Replace string concatenation with array.push() + join()",
        "Replace categories.includes() with Set for O(1) lookup",
        "Avoid repeated .filter() for same category",
      ],
    },
    {
      name: "processEvents",
      file: "src/event-processor.ts",
      description: "Process and deduplicate a stream of events with time windows",
      slowCode: `import { EventRecord, ProcessedBatch } from "./types";

// Process events: deduplicate by (source, eventType) within each time window,
// compute aggregates per window, and return batched results.
// Windows are non-overlapping intervals of windowSize milliseconds.
export function processEvents(
  events: EventRecord[],
  windowSize: number
): ProcessedBatch[] {
  // Sort by timestamp
  const sorted = events.slice().sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length === 0) return [];

  const minTime = sorted[0].timestamp;
  const maxTime = sorted[sorted.length - 1].timestamp;

  const batches: ProcessedBatch[] = [];

  for (let windowStart = minTime; windowStart <= maxTime; windowStart += windowSize) {
    const windowEnd = windowStart + windowSize;

    // Find events in this window
    const windowEvents = sorted.filter(
      e => e.timestamp >= windowStart && e.timestamp < windowEnd
    );

    // Deduplicate: keep first occurrence of each (source, eventType) pair
    const deduped: EventRecord[] = [];
    for (const event of windowEvents) {
      const isDuplicate = deduped.some(
        d => d.source === event.source && d.eventType === event.eventType
      );
      if (!isDuplicate) {
        deduped.push(event);
      }
    }

    if (deduped.length === 0) continue;

    // Compute aggregates
    const totalValue = deduped.reduce((sum, e) => sum + e.value, 0);
    const sources = new Set(deduped.map(e => e.source));

    // Find the dominant event type (most occurrences in original window, not deduped)
    const typeCounts: Record<string, number> = {};
    for (const e of windowEvents) {
      typeCounts[e.eventType] = (typeCounts[e.eventType] || 0) + 1;
    }
    let dominantType = "";
    let maxCount = 0;
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    batches.push({
      windowStart,
      windowEnd,
      eventCount: deduped.length,
      totalValue: Math.round(totalValue * 100) / 100,
      uniqueSources: sources.size,
      dominantType,
      duplicatesRemoved: windowEvents.length - deduped.length,
    });
  }

  return batches;
}`,
      helperFiles: {
        "src/types.ts": `export interface EventRecord {
  id: string;
  source: string;
  eventType: string;
  value: number;
  timestamp: number;
}

export interface ProcessedBatch {
  windowStart: number;
  windowEnd: number;
  eventCount: number;
  totalValue: number;
  uniqueSources: number;
  dominantType: string;
  duplicatesRemoved: number;
}`,
      },
      benchmarkCode: `import { processEvents } from "./event-processor";
import { EventRecord } from "./types";

const SIZE = ${arraySize};
const sources = ["sensor-A", "sensor-B", "sensor-C", "sensor-D", "sensor-E"];
const types = ["temperature", "humidity", "pressure", "wind", "light"];
const events: EventRecord[] = Array.from({ length: SIZE }, (_, i) => ({
  id: \`evt-\${i}\`,
  source: sources[i % sources.length],
  eventType: types[Math.floor(Math.random() * types.length)],
  value: Math.random() * 100,
  timestamp: 1700000000000 + Math.floor(Math.random() * 3600000),
}));

console.log("Benchmarking processEvents with", SIZE, "events...");
const start = performance.now();
const result = processEvents(events, 60000);
const elapsed = performance.now() - start;

console.log(\`Batches: \${result.length}\`);
console.log(\`Time: \${elapsed.toFixed(2)}ms\`);`,
      testCode: `import { processEvents } from "./event-processor";
import { EventRecord } from "./types";

const events: EventRecord[] = [
  { id: "1", source: "A", eventType: "temp", value: 10, timestamp: 1000 },
  { id: "2", source: "A", eventType: "temp", value: 20, timestamp: 1500 },
  { id: "3", source: "B", eventType: "temp", value: 30, timestamp: 2000 },
  { id: "4", source: "A", eventType: "humidity", value: 40, timestamp: 5000 },
  { id: "5", source: "B", eventType: "temp", value: 50, timestamp: 5500 },
];

describe("processEvents", () => {
  test("groups events into time windows", () => {
    const result = processEvents(events, 3000);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
  test("deduplicates by source+type within window", () => {
    const result = processEvents(events, 10000);
    expect(result[0].duplicatesRemoved).toBeGreaterThan(0);
  });
  test("returns empty for empty input", () => {
    expect(processEvents([], 1000)).toEqual([]);
  });
  test("computes correct totalValue from deduped events", () => {
    const result = processEvents(events, 10000);
    expect(result[0].totalValue).toBeGreaterThan(0);
  });
});`,
      optimalApproach: "Three bottlenecks: (1) sorted.filter() for each window scans the entire array -- use binary search or pointer to find window boundaries in O(log n), (2) deduped.some() for deduplication is O(k^2) per window -- use a Set with composite key, (3) iterating empty windows when data is sparse wastes time -- group events into windows using a Map instead of iterating all possible windows.",
      optimalComplexity: "O(n log n) for sorting + O(n) for single-pass grouping",
      optimizations: [
        "Replace per-window filter() with index-based window boundaries on sorted array",
        "Replace deduped.some() with Set<string> using composite key 'source:eventType'",
        "Group events into windows via Map<windowKey, events> instead of iterating empty windows",
        "Compute aggregates during grouping instead of separate passes",
      ],
    },
    {
      name: "rankCandidates",
      file: "src/ranker.ts",
      description: "Rank job candidates by multi-criteria scoring with peer comparison",
      slowCode: `import { Candidate, RankingResult, ScoringWeights } from "./types";

// Rank candidates by weighted multi-criteria score. Each criterion is normalized
// relative to the pool (percentile rank). Final score = weighted sum of percentile ranks.
// Red flag: candidates below threshold in any criterion are demoted.
export function rankCandidates(
  candidates: Candidate[],
  weights: ScoringWeights,
  demotionThreshold: number
): RankingResult[] {
  const results: RankingResult[] = [];

  for (const candidate of candidates) {
    // Compute percentile rank for each criterion
    const experiencePercentile = computePercentile(
      candidate.experience,
      candidates.map(c => c.experience)
    );
    const skillScorePercentile = computePercentile(
      candidate.skillScore,
      candidates.map(c => c.skillScore)
    );
    const interviewPercentile = computePercentile(
      candidate.interviewScore,
      candidates.map(c => c.interviewScore)
    );
    const referencePercentile = computePercentile(
      candidate.referenceScore,
      candidates.map(c => c.referenceScore)
    );

    const weightedScore =
      experiencePercentile * weights.experience +
      skillScorePercentile * weights.skillScore +
      interviewPercentile * weights.interviewScore +
      referencePercentile * weights.referenceScore;

    // Check for red flags (any criterion below threshold percentile)
    const demoted =
      experiencePercentile < demotionThreshold ||
      skillScorePercentile < demotionThreshold ||
      interviewPercentile < demotionThreshold ||
      referencePercentile < demotionThreshold;

    results.push({
      candidateId: candidate.id,
      finalScore: Math.round(weightedScore * 1000) / 1000,
      demoted,
      percentiles: {
        experience: experiencePercentile,
        skillScore: skillScorePercentile,
        interview: interviewPercentile,
        reference: referencePercentile,
      },
    });
  }

  // Sort by demoted status first, then by score descending
  results.sort((a, b) => {
    if (a.demoted !== b.demoted) return a.demoted ? 1 : -1;
    return b.finalScore - a.finalScore;
  });

  return results;
}

// Compute the percentile rank of a value within an array.
// Returns a value between 0 and 1.
function computePercentile(value: number, all: number[]): number {
  const sorted = [...all].sort((a, b) => a - b);
  let rank = 0;
  for (const v of sorted) {
    if (v < value) rank++;
    else if (v === value) rank += 0.5;
  }
  return rank / sorted.length;
}`,
      helperFiles: {
        "src/types.ts": `export interface Candidate {
  id: string;
  name: string;
  experience: number;
  skillScore: number;
  interviewScore: number;
  referenceScore: number;
}

export interface ScoringWeights {
  experience: number;
  skillScore: number;
  interviewScore: number;
  referenceScore: number;
}

export interface RankingResult {
  candidateId: string;
  finalScore: number;
  demoted: boolean;
  percentiles: {
    experience: number;
    skillScore: number;
    interview: number;
    reference: number;
  };
}`,
      },
      benchmarkCode: `import { rankCandidates } from "./ranker";
import { Candidate, ScoringWeights } from "./types";

const SIZE = ${Math.floor(arraySize / 2)};
const candidates: Candidate[] = Array.from({ length: SIZE }, (_, i) => ({
  id: \`c-\${i}\`,
  name: \`Candidate \${i}\`,
  experience: Math.floor(Math.random() * 20),
  skillScore: Math.floor(Math.random() * 100),
  interviewScore: Math.floor(Math.random() * 100),
  referenceScore: Math.floor(Math.random() * 100),
}));

const weights: ScoringWeights = { experience: 0.3, skillScore: 0.3, interviewScore: 0.25, referenceScore: 0.15 };

console.log("Benchmarking rankCandidates with", SIZE, "candidates...");
const start = performance.now();
const result = rankCandidates(candidates, weights, 0.2);
const elapsed = performance.now() - start;

console.log(\`Ranked: \${result.length}\`);
console.log(\`Time: \${elapsed.toFixed(2)}ms\`);`,
      testCode: `import { rankCandidates } from "./ranker";
import { Candidate, ScoringWeights } from "./types";

const candidates: Candidate[] = [
  { id: "1", name: "Alice", experience: 10, skillScore: 90, interviewScore: 85, referenceScore: 80 },
  { id: "2", name: "Bob", experience: 5, skillScore: 95, interviewScore: 70, referenceScore: 90 },
  { id: "3", name: "Carol", experience: 15, skillScore: 60, interviewScore: 95, referenceScore: 75 },
  { id: "4", name: "Dave", experience: 2, skillScore: 40, interviewScore: 50, referenceScore: 60 },
];
const weights: ScoringWeights = { experience: 0.25, skillScore: 0.25, interviewScore: 0.25, referenceScore: 0.25 };

describe("rankCandidates", () => {
  test("returns all candidates", () => {
    const result = rankCandidates(candidates, weights, 0.2);
    expect(result).toHaveLength(4);
  });
  test("demoted candidates are ranked last", () => {
    const result = rankCandidates(candidates, weights, 0.4);
    const firstDemotedIdx = result.findIndex(r => r.demoted);
    const lastNonDemotedIdx = result.length - 1 - [...result].reverse().findIndex(r => !r.demoted);
    if (firstDemotedIdx >= 0 && lastNonDemotedIdx >= 0) {
      expect(firstDemotedIdx).toBeGreaterThan(lastNonDemotedIdx);
    }
  });
  test("non-demoted are sorted by score descending", () => {
    const result = rankCandidates(candidates, weights, 0.1);
    const nonDemoted = result.filter(r => !r.demoted);
    for (let i = 1; i < nonDemoted.length; i++) {
      expect(nonDemoted[i].finalScore).toBeLessThanOrEqual(nonDemoted[i-1].finalScore);
    }
  });
});`,
      optimalApproach: "Dominant bottleneck: computePercentile() is called 4 times per candidate, and each call creates a sorted copy of ALL candidates' values for that criterion. This is O(n^2 log n) total. Fix: pre-sort each criterion's values ONCE, then use binary search for percentile lookup. Also, candidates.map(c => c.experience) etc. creates a new array every call -- extract these once.",
      optimalComplexity: "O(n log n) with pre-sorted criterion arrays and binary search percentile lookup",
      optimizations: [
        "Pre-extract and sort each criterion's values once, not per-candidate",
        "Use binary search on pre-sorted arrays for O(log n) percentile lookup",
        "Avoid creating new arrays via .map() inside the per-candidate loop",
        "Cache sorted arrays rather than re-sorting n*4 times",
      ],
    },
    {
      name: "resolveConflicts",
      file: "src/conflict-resolver.ts",
      description: "Resolve scheduling conflicts by finding non-overlapping maximum-value subset",
      slowCode: `import { ScheduleItem, Resolution } from "./types";

// Given a list of schedule items (each with start, end, value), find the
// maximum-value subset of non-overlapping items. Items overlap if one starts
// before the other ends.
//
// Also returns the conflict graph: for each item, which items it conflicts with.
export function resolveConflicts(items: ScheduleItem[]): Resolution {
  const sorted = [...items].sort((a, b) => a.end - b.end);

  // Build conflict graph (for reporting)
  const conflicts: Record<string, string[]> = {};
  for (const item of sorted) {
    conflicts[item.id] = [];
    for (const other of sorted) {
      if (item.id === other.id) continue;
      if (item.start < other.end && item.end > other.start) {
        conflicts[item.id].push(other.id);
      }
    }
  }

  // Find maximum-value non-overlapping subset
  // Dynamic programming approach, but with a slow "find previous compatible" step
  const n = sorted.length;
  if (n === 0) return { selectedIds: [], totalValue: 0, conflicts };

  const dp = new Array(n).fill(0);
  dp[0] = sorted[0].value;

  for (let i = 1; i < n; i++) {
    const includeVal = sorted[i].value + findPrevValue(sorted, dp, i);
    const excludeVal = dp[i - 1];
    dp[i] = Math.max(includeVal, excludeVal);
  }

  // Backtrack to find selected items
  const selected: string[] = [];
  let i = n - 1;
  while (i >= 0) {
    const prev = findPrevIndex(sorted, i);
    const includeVal = sorted[i].value + (prev >= 0 ? dp[prev] : 0);
    if (i === 0 || includeVal > dp[i - 1]) {
      selected.push(sorted[i].id);
      i = prev;
    } else {
      i--;
    }
  }

  return {
    selectedIds: selected.reverse(),
    totalValue: dp[n - 1],
    conflicts,
  };
}

// Find the DP value of the latest item that ends before sorted[i] starts.
// This is the bottleneck: linear scan for each item = O(n^2) total.
function findPrevValue(sorted: ScheduleItem[], dp: number[], i: number): number {
  const idx = findPrevIndex(sorted, i);
  return idx >= 0 ? dp[idx] : 0;
}

function findPrevIndex(sorted: ScheduleItem[], i: number): number {
  for (let j = i - 1; j >= 0; j--) {
    if (sorted[j].end <= sorted[i].start) {
      return j;
    }
  }
  return -1;
}`,
      helperFiles: {
        "src/types.ts": `export interface ScheduleItem {
  id: string;
  name: string;
  start: number;
  end: number;
  value: number;
}

export interface Resolution {
  selectedIds: string[];
  totalValue: number;
  conflicts: Record<string, string[]>;
}`,
      },
      benchmarkCode: `import { resolveConflicts } from "./conflict-resolver";
import { ScheduleItem } from "./types";

const SIZE = ${Math.floor(arraySize / 4)};
const items: ScheduleItem[] = Array.from({ length: SIZE }, (_, i) => {
  const start = Math.floor(Math.random() * 10000);
  const duration = 10 + Math.floor(Math.random() * 200);
  return {
    id: \`item-\${i}\`,
    name: \`Meeting \${i}\`,
    start,
    end: start + duration,
    value: Math.floor(Math.random() * 100) + 1,
  };
});

console.log("Benchmarking resolveConflicts with", SIZE, "items...");
const start = performance.now();
const result = resolveConflicts(items);
const elapsed = performance.now() - start;

console.log(\`Selected: \${result.selectedIds.length}, Value: \${result.totalValue}\`);
console.log(\`Time: \${elapsed.toFixed(2)}ms\`);`,
      testCode: `import { resolveConflicts } from "./conflict-resolver";
import { ScheduleItem } from "./types";

const items: ScheduleItem[] = [
  { id: "a", name: "A", start: 0, end: 3, value: 5 },
  { id: "b", name: "B", start: 2, end: 5, value: 6 },
  { id: "c", name: "C", start: 4, end: 7, value: 5 },
  { id: "d", name: "D", start: 6, end: 9, value: 4 },
];

describe("resolveConflicts", () => {
  test("selects non-overlapping items", () => {
    const result = resolveConflicts(items);
    for (let i = 0; i < result.selectedIds.length; i++) {
      for (let j = i + 1; j < result.selectedIds.length; j++) {
        const a = items.find(it => it.id === result.selectedIds[i])!;
        const b = items.find(it => it.id === result.selectedIds[j])!;
        expect(a.end <= b.start || b.end <= a.start).toBe(true);
      }
    }
  });
  test("builds conflict graph", () => {
    const result = resolveConflicts(items);
    expect(result.conflicts["a"]).toContain("b");
    expect(result.conflicts["b"]).toContain("a");
  });
  test("empty input", () => {
    const result = resolveConflicts([]);
    expect(result.selectedIds).toEqual([]);
    expect(result.totalValue).toBe(0);
  });
  test("maximizes total value", () => {
    const result = resolveConflicts(items);
    expect(result.totalValue).toBeGreaterThanOrEqual(10);
  });
});`,
      optimalApproach: "Two bottlenecks: (1) The conflict graph construction is O(n^2) -- can be optimized with sorted intervals and sweep line for sparse conflicts, but the bigger issue is (2) findPrevIndex uses linear scan backwards making the DP O(n^2) total. Replace with binary search on the sorted end times to find the latest compatible item in O(log n). The conflict graph is still O(n^2) worst case for dense overlaps but the DP bottleneck dominates for typical inputs.",
      optimalComplexity: "O(n log n) for DP with binary search, O(n^2) worst case for conflict graph",
      optimizations: [
        "Replace linear findPrevIndex scan with binary search on sorted end times",
        "Pre-extract end times into array for efficient binary search",
        "Consider sweep-line for conflict graph construction",
        "The DP findPrevValue/findPrevIndex is called n times with linear scan = O(n^2); binary search makes it O(n log n)",
      ],
    },
  ];
}

export function generateOptimizerData(seed: number): OptimizerData {
  const rng = mulberry32(seed);

  const problems = generateProblems(rng);
  const template = problems[Math.floor(rng() * problems.length)];

  const files: Record<string, string> = {};

  files[template.file] = template.slowCode;
  for (const [path, content] of Object.entries(template.helperFiles)) {
    files[path] = content;
  }

  files["benchmark.ts"] = template.benchmarkCode;
  const testPath = template.file.replace("src/", "tests/").replace(".ts", ".test.ts");
  files[testPath] = template.testCode;

  files["package.json"] = `{
  "name": "perf-challenge",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "benchmark": "tsx benchmark.ts",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsx": "^4.19.0"
  }
}`;

  files["tsconfig.json"] = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "tests/**/*", "benchmark.ts"]
}`;

  const objective =
    `Optimize the \`${template.name}()\` function in \`${template.file}\`. ` +
    `The current implementation is correct but has hidden performance bottlenecks. ` +
    `The slow paths are NOT marked with complexity comments — you must identify them by reading the code carefully. ` +
    `Some code that looks slow may not be the actual bottleneck. ` +
    `Rewrite the function to be as fast as possible while keeping the same behavior. Tests must still pass.`;

  return {
    objective,
    groundTruth: {
      optimal_approach: template.optimalApproach,
      optimal_complexity: template.optimalComplexity,
      optimizations: template.optimizations,
      function_name: template.name,
      file_path: template.file,
    },
    files,
  };
}
