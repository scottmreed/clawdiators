import { mulberry32 } from "../../services/whimsy.js";

export interface CodeSpec {
  task_type: string;
  description: string;
  examples: Array<{ input: unknown; output: unknown }>;
}

export interface TestInput {
  id: string;
  input: unknown;
}

export interface DepthFirstGroundTruth {
  test_outputs: Array<{ id: string; expected_output: unknown }>;
  task_type: string;
}

export interface DepthFirstData {
  spec: CodeSpec;
  test_inputs: TestInput[];
  groundTruth: DepthFirstGroundTruth;
  objective: string;
}

interface TaskGenerator {
  type: string;
  generate: (rng: () => number) => {
    description: string;
    examples: Array<{ input: unknown; output: unknown }>;
    tests: Array<{ input: unknown; output: unknown }>;
  };
}

// Multi-step array transform with position-dependent rules
function generatePositionalTransform(rng: () => number) {
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const multiplier = randInt(2, 5);
  const modulus = randInt(3, 5);
  const variant = Math.floor(rng() * 3);

  let transform: (arr: number[]) => number[];
  let description: string;

  if (variant === 0) {
    // Multiply elements at positions divisible by modulus, negate the rest, sort by absolute value
    transform = (arr: number[]) => {
      const mapped = arr.map((v, i) =>
        (i + 1) % modulus === 0 ? v * multiplier : -v
      );
      return mapped.sort((a, b) => Math.abs(a) - Math.abs(b));
    };
    description = "Infer the transformation rule from examples.";
  } else if (variant === 1) {
    // Running sum of even-indexed elements, cumulative product of odd-indexed (capped)
    transform = (arr: number[]) => {
      const result: number[] = [];
      let runSum = 0;
      let runProd = 1;
      for (let i = 0; i < arr.length; i++) {
        if (i % 2 === 0) {
          runSum += arr[i];
          result.push(runSum);
        } else {
          runProd = (runProd * Math.abs(arr[i])) % 1000;
          result.push(runProd);
        }
      }
      return result;
    };
    description = "Infer the transformation rule from examples.";
  } else {
    // Pairwise absolute differences, then map each to parity-signed value and sort by |value| desc.
    transform = (arr: number[]) => {
      if (arr.length < 2) return arr;
      const mapped: number[] = [];
      for (let i = 0; i < arr.length - 1; i++) {
        const diff = Math.abs(arr[i + 1] - arr[i]);
        const signed = diff % 2 === 0 ? diff : -diff;
        mapped.push(signed + (i % 3));
      }
      return [...new Set(mapped)].sort((a, b) => Math.abs(b) - Math.abs(a) || b - a);
    };
    description = "Infer the transformation rule from examples.";
  }

  const makeArray = (len: number) =>
    Array.from({ length: len }, () => randInt(-15, 25));

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 6; i++) {
    const arr = makeArray(randInt(5, 9));
    examples.push({ input: arr, output: transform(arr) });
  }

  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 30; i++) {
    const arr = makeArray(randInt(4, 12));
    tests.push({ input: arr, output: transform(arr) });
  }

  return { description, examples, tests };
}

// Complex string transformation with conditional rules
function generateConditionalString(rng: () => number) {
  const variant = Math.floor(rng() * 3);

  const wordPools = [
    ["reef", "coral", "tide", "wave", "shell", "crab", "pearl", "anchor", "sail", "storm",
     "kelp", "trident", "abyss", "current", "shoal", "barnacle"],
    ["arena", "claw", "gladiator", "shield", "sword", "battle", "victory", "honor", "forge",
     "champion", "titan", "serpent", "dragon", "valor", "fury", "ember"],
  ];
  const pool = wordPools[Math.floor(rng() * wordPools.length)];
  const pick = () => pool[Math.floor(rng() * pool.length)];

  let transform: (s: string) => string;

  if (variant === 0) {
    // Words with even length: reverse. Words with odd length: uppercase. Then sort all words alphabetically.
    transform = (s: string) => {
      const words = s.split(" ");
      const transformed = words.map(w =>
        w.length % 2 === 0 ? w.split("").reverse().join("") : w.toUpperCase()
      );
      return transformed.sort().join(" ");
    };
  } else if (variant === 1) {
    // For each word: if it starts with a vowel, prepend "the-". If consonant, append its length.
    // Then reverse the entire word order.
    transform = (s: string) => {
      const vowels = "aeiouAEIOU";
      const words = s.split(" ");
      const transformed = words.map(w =>
        vowels.includes(w[0]) ? `the-${w}` : `${w}${w.length}`
      );
      return transformed.reverse().join(" ");
    };
  } else {
    // Caesar shift each character by position in word (0-indexed).
    // Non-alpha chars pass through. Then lowercase everything.
    transform = (s: string) => {
      const words = s.split(" ");
      const shifted = words.map(w => {
        let result = "";
        for (let i = 0; i < w.length; i++) {
          const c = w.charCodeAt(i);
          if (c >= 97 && c <= 122) {
            result += String.fromCharCode(((c - 97 + i) % 26) + 97);
          } else if (c >= 65 && c <= 90) {
            result += String.fromCharCode(((c - 65 + i) % 26) + 97);
          } else {
            result += w[i];
          }
        }
        return result;
      });
      return shifted.join(" ");
    };
  }

  const makeSentence = (wordCount: number) =>
    Array.from({ length: wordCount }, () => pick()).join(" ");

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 6; i++) {
    const sentence = makeSentence(Math.floor(rng() * 3) + 3);
    examples.push({ input: sentence, output: transform(sentence) });
  }

  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 30; i++) {
    const sentence = makeSentence(Math.floor(rng() * 4) + 3);
    tests.push({ input: sentence, output: transform(sentence) });
  }

  return { description: "Infer the transformation rule from examples.", examples, tests };
}

// Object/record transformation with multi-step pipeline
function generateRecordTransform(rng: () => number) {
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const variant = Math.floor(rng() * 3);

  type Record_ = { name: string; values: number[]; tags: string[] };

  const names = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
  const tagPool = ["hot", "cold", "fast", "slow", "big", "small", "new", "old"];
  const threshold = randInt(15, 30);

  let transform: (rec: Record_) => unknown;

  if (variant === 0) {
    // Filter values > threshold, compute mean of remaining. If mean > threshold * 2, tag as "critical".
    // Return {name, filtered_mean, tag_count, status}
    transform = (rec: Record_) => {
      const filtered = rec.values.filter(v => v > threshold);
      const mean = filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : 0;
      return {
        name: rec.name,
        filtered_mean: Math.round(mean * 100) / 100,
        tag_count: rec.tags.length,
        status: mean > threshold * 2 ? "critical" : "normal",
      };
    };
  } else if (variant === 1) {
    // Sort values descending, take top 3 (or fewer). Combine tags into single string sorted alphabetically.
    // Return {name, top_values, combined_tags, total}
    transform = (rec: Record_) => {
      const sorted = [...rec.values].sort((a, b) => b - a);
      const top = sorted.slice(0, 3);
      const combinedTags = [...rec.tags].sort().join(",");
      return {
        name: rec.name,
        top_values: top,
        combined_tags: combinedTags,
        total: top.reduce((a, b) => a + b, 0),
      };
    };
  } else {
    // Compute running max of values. Count values that set a new max. Tags with length > 3 get uppercased.
    // Return {name, running_max, new_max_count, processed_tags}
    transform = (rec: Record_) => {
      let max = -Infinity;
      let newMaxCount = 0;
      const runningMax: number[] = [];
      for (const v of rec.values) {
        if (v > max) { max = v; newMaxCount++; }
        runningMax.push(max);
      }
      const processedTags = rec.tags.map(t => t.length > 3 ? t.toUpperCase() : t);
      return {
        name: rec.name,
        running_max: runningMax,
        new_max_count: newMaxCount,
        processed_tags: processedTags,
      };
    };
  }

  const makeRecord = (): Record_ => ({
    name: names[Math.floor(rng() * names.length)],
    values: Array.from({ length: randInt(4, 8) }, () => randInt(5, 60)),
    tags: Array.from({ length: randInt(1, 4) }, () => tagPool[Math.floor(rng() * tagPool.length)]),
  });

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 6; i++) {
    const rec = makeRecord();
    examples.push({ input: rec, output: transform(rec) });
  }

  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 30; i++) {
    const rec = makeRecord();
    tests.push({ input: rec, output: transform(rec) });
  }

  return { description: "Infer the transformation rule from examples.", examples, tests };
}

// Matrix/grid transformation
function generateGridTransform(rng: () => number) {
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const variant = Math.floor(rng() * 2);

  let transform: (grid: number[][]) => unknown;

  if (variant === 0) {
    // Rotate 90 degrees clockwise, then replace each cell with the sum of its von Neumann neighbors
    transform = (grid: number[][]) => {
      const rows = grid.length;
      const cols = grid[0]?.length ?? 0;
      // Rotate 90 CW: new[j][rows-1-i] = old[i][j]
      const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          rotated[j][rows - 1 - i] = grid[i][j];
        }
      }
      const rr = rotated.length;
      const rc = rotated[0]?.length ?? 0;
      const result: number[][] = Array.from({ length: rr }, () => Array(rc).fill(0));
      for (let i = 0; i < rr; i++) {
        for (let j = 0; j < rc; j++) {
          let sum = 0;
          if (i > 0) sum += rotated[i - 1][j];
          if (i < rr - 1) sum += rotated[i + 1][j];
          if (j > 0) sum += rotated[i][j - 1];
          if (j < rc - 1) sum += rotated[i][j + 1];
          result[i][j] = sum;
        }
      }
      return result;
    };
  } else {
    // Transpose, then for each row: replace values with their rank within that row (1-indexed, ties get same rank)
    transform = (grid: number[][]) => {
      const rows = grid.length;
      const cols = grid[0]?.length ?? 0;
      // Transpose
      const transposed: number[][] = Array.from({ length: cols }, (_, j) =>
        Array.from({ length: rows }, (_, i) => grid[i][j])
      );
      // Rank within each row
      return transposed.map(row => {
        const sorted = [...row].sort((a, b) => a - b);
        return row.map(v => sorted.indexOf(v) + 1);
      });
    };
  }

  const makeGrid = (r: number, c: number) =>
    Array.from({ length: r }, () =>
      Array.from({ length: c }, () => randInt(1, 20))
    );

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 6; i++) {
    const r = randInt(3, 4);
    const c = randInt(3, 4);
    const grid = makeGrid(r, c);
    examples.push({ input: grid, output: transform(grid) });
  }

  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 30; i++) {
    const r = randInt(3, 5);
    const c = randInt(3, 5);
    const grid = makeGrid(r, c);
    tests.push({ input: grid, output: transform(grid) });
  }

  return { description: "Infer the transformation rule from examples.", examples, tests };
}

const TASK_GENERATORS: TaskGenerator[] = [
  { type: "positional_transform", generate: generatePositionalTransform },
  { type: "conditional_string", generate: generateConditionalString },
  { type: "record_pipeline", generate: generateRecordTransform },
  { type: "grid_transform", generate: generateGridTransform },
];

export function generateDepthFirstData(seed: number): DepthFirstData {
  const rng = mulberry32(seed);

  const taskGen = TASK_GENERATORS[Math.floor(rng() * TASK_GENERATORS.length)];
  const { description, examples, tests } = taskGen.generate(rng);

  const spec: CodeSpec = {
    task_type: taskGen.type,
    description,
    examples,
  };

  const test_inputs: TestInput[] = tests.map((t, i) => ({
    id: `test-${seed}-${i}`,
    input: t.input,
  }));

  const groundTruth: DepthFirstGroundTruth = {
    test_outputs: tests.map((t, i) => ({
      id: `test-${seed}-${i}`,
      expected_output: t.output,
    })),
    task_type: taskGen.type,
  };

  const objective =
    "You are given 6 worked examples of an input-output transformation. The rule is NOT described — " +
    "you must infer it from the examples alone. The rule may involve multiple steps, " +
    "position-dependent operations, or conditional logic. " +
    "Apply the inferred rule to 30 test inputs. " +
    `Submit your answers as a JSON object mapping each test ID to its output — ` +
    `e.g. { "${test_inputs[0].id}": <output>, "${test_inputs[1].id}": <output>, ... }.`;

  return { spec, test_inputs, groundTruth, objective };
}
