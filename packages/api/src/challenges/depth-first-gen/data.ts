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

// ── Task type generators ──────────────────────────────────────────────

interface TaskGenerator {
  type: string;
  generate: (rng: () => number) => {
    description: string;
    examples: Array<{ input: unknown; output: unknown }>;
    tests: Array<{ input: unknown; output: unknown }>;
  };
}

// ── Array Transform ───────────────────────────────────────────────────

function generateArrayTransform(rng: () => number) {
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  // Pick a transform variant
  const variant = Math.floor(rng() * 3);

  let description: string;
  let transform: (arr: number[]) => number[];

  if (variant === 0) {
    // Double evens, remove odds, sort ascending
    description =
      "Given an array of integers, double every even number, remove all odd numbers, and return the result sorted in ascending order.";
    transform = (arr: number[]) =>
      arr.filter((n) => n % 2 === 0).map((n) => n * 2).sort((a, b) => a - b);
  } else if (variant === 1) {
    // Square each, keep only > 10, sort descending
    description =
      "Given an array of integers, square each number, keep only values greater than 10, and return the result sorted in descending order.";
    transform = (arr: number[]) =>
      arr.map((n) => n * n).filter((n) => n > 10).sort((a, b) => b - a);
  } else {
    // Absolute value, remove duplicates, sort ascending
    description =
      "Given an array of integers, take the absolute value of each, remove duplicates, and return the result sorted in ascending order.";
    transform = (arr: number[]) =>
      [...new Set(arr.map((n) => Math.abs(n)))].sort((a, b) => a - b);
  }

  // Generate examples
  const makeArray = (len: number) =>
    Array.from({ length: len }, () => randInt(-20, 30));

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 3; i++) {
    const arr = makeArray(randInt(4, 7));
    examples.push({ input: arr, output: transform(arr) });
  }

  // Generate 20 test cases
  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 20; i++) {
    const arr = makeArray(randInt(3, 12));
    tests.push({ input: arr, output: transform(arr) });
  }

  return { description, examples, tests };
}

// ── String Pattern ────────────────────────────────────────────────────

function generateStringPattern(rng: () => number) {
  const variant = Math.floor(rng() * 3);

  const wordPools = [
    ["reef", "coral", "tide", "wave", "shell", "crab", "pearl", "anchor", "sail", "storm"],
    ["arena", "claw", "trident", "gladiator", "shield", "sword", "battle", "victory", "honor", "forge"],
    ["deep", "dark", "blue", "swift", "bright", "sharp", "cold", "wild", "fierce", "bold"],
  ];
  const pool = wordPools[Math.floor(rng() * wordPools.length)];
  const pick = () => pool[Math.floor(rng() * pool.length)];

  let description: string;
  let transform: (s: string) => string;

  if (variant === 0) {
    // Reverse each word, keep order
    description =
      "Given a sentence (space-separated words), reverse each individual word but keep the word order unchanged. Return the result as a single string.";
    transform = (s: string) =>
      s.split(" ").map((w) => w.split("").reverse().join("")).join(" ");
  } else if (variant === 1) {
    // Capitalize alternating characters (0-indexed: even=upper, odd=lower)
    description =
      "Given a string, capitalize characters at even indices (0-based) and lowercase characters at odd indices. Spaces count as characters for indexing purposes.";
    transform = (s: string) =>
      s.split("").map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase())).join("");
  } else {
    // Remove vowels
    description =
      "Given a string, remove all vowels (a, e, i, o, u — both uppercase and lowercase) and return the remaining characters.";
    transform = (s: string) => s.replace(/[aeiouAEIOU]/g, "");
  }

  const makeSentence = (wordCount: number) =>
    Array.from({ length: wordCount }, () => pick()).join(" ");

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 3; i++) {
    const sentence = makeSentence(Math.floor(rng() * 3) + 2);
    examples.push({ input: sentence, output: transform(sentence) });
  }

  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 20; i++) {
    const sentence = makeSentence(Math.floor(rng() * 4) + 2);
    tests.push({ input: sentence, output: transform(sentence) });
  }

  return { description, examples, tests };
}

// ── Number Sequence ───────────────────────────────────────────────────

function generateNumberSequence(rng: () => number) {
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const variant = Math.floor(rng() * 3);

  let description: string;
  let generateSequence: (startSeed: number) => { given: number[]; answer: number[] };

  if (variant === 0) {
    // Arithmetic sequence: a, a+d, a+2d, ...
    const d = randInt(2, 7);
    description = `Given the first few numbers of an arithmetic sequence with common difference ${d}, predict the next 3 numbers.`;
    generateSequence = (startSeed: number) => {
      const a = startSeed;
      const given = Array.from({ length: 5 }, (_, i) => a + i * d);
      const answer = Array.from({ length: 3 }, (_, i) => a + (5 + i) * d);
      return { given, answer };
    };
  } else if (variant === 1) {
    // Geometric sequence: a, a*r, a*r^2, ...
    const r = randInt(2, 4);
    description = `Given the first few numbers of a geometric sequence with common ratio ${r}, predict the next 3 numbers.`;
    generateSequence = (startSeed: number) => {
      const a = Math.max(1, startSeed % 5 + 1);
      const given = Array.from({ length: 5 }, (_, i) => a * Math.pow(r, i));
      const answer = Array.from({ length: 3 }, (_, i) => a * Math.pow(r, 5 + i));
      return { given, answer };
    };
  } else {
    // Fibonacci-like: each number is sum of previous two
    description =
      "Given the first few numbers of a Fibonacci-like sequence (each number is the sum of the two preceding numbers), predict the next 3 numbers.";
    generateSequence = (startSeed: number) => {
      const a = (startSeed % 5) + 1;
      const b = ((startSeed * 3) % 7) + 2;
      const seq = [a, b];
      for (let i = 2; i < 8; i++) {
        seq.push(seq[i - 1] + seq[i - 2]);
      }
      return { given: seq.slice(0, 5), answer: seq.slice(5, 8) };
    };
  }

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 3; i++) {
    const seed = randInt(1, 20);
    const { given, answer } = generateSequence(seed);
    examples.push({ input: given, output: answer });
  }

  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 20; i++) {
    const seed = randInt(1, 50);
    const { given, answer } = generateSequence(seed);
    tests.push({ input: given, output: answer });
  }

  return { description, examples, tests };
}

// ── Run-Length Codec ──────────────────────────────────────────────────

function generateRunLengthCodec(rng: () => number) {
  const variant = Math.floor(rng() * 2);

  let description: string;
  let transform: (s: string) => string;

  if (variant === 0) {
    // Encode: "aaabbc" -> "a3b2c1"
    description =
      'Given a string, return its run-length encoded version. Each run of consecutive identical characters is replaced by the character followed by its count. Example: "aaabbc" becomes "a3b2c1".';
    transform = (s: string) => {
      if (s.length === 0) return "";
      let result = "";
      let current = s[0];
      let count = 1;
      for (let i = 1; i < s.length; i++) {
        if (s[i] === current) {
          count++;
        } else {
          result += current + String(count);
          current = s[i];
          count = 1;
        }
      }
      result += current + String(count);
      return result;
    };
  } else {
    // Decode: "a3b2c1" -> "aaabbc"
    description =
      'Given a run-length encoded string (character followed by its count), decode it back to the original string. Example: "a3b2c1" becomes "aaabbc".';
    transform = (s: string) => {
      let result = "";
      for (let i = 0; i < s.length; i += 2) {
        const ch = s[i];
        const count = parseInt(s[i + 1], 10);
        result += ch.repeat(count);
      }
      return result;
    };
  }

  const letters = "abcdefghijklmnopqrstuvwxyz";

  const makeString = (variant: number): string => {
    if (variant === 0) {
      // For encoding: generate a string with runs
      let s = "";
      const segments = Math.floor(rng() * 4) + 2;
      for (let i = 0; i < segments; i++) {
        const ch = letters[Math.floor(rng() * 10)];
        const runLen = Math.floor(rng() * 4) + 1;
        s += ch.repeat(runLen);
      }
      return s;
    } else {
      // For decoding: generate a valid encoded string
      let s = "";
      const segments = Math.floor(rng() * 4) + 2;
      for (let i = 0; i < segments; i++) {
        const ch = letters[Math.floor(rng() * 10)];
        const count = Math.floor(rng() * 4) + 1;
        s += ch + String(count);
      }
      return s;
    }
  };

  const examples: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 3; i++) {
    const input = makeString(variant);
    examples.push({ input, output: transform(input) });
  }

  const tests: Array<{ input: unknown; output: unknown }> = [];
  for (let i = 0; i < 20; i++) {
    const input = makeString(variant);
    tests.push({ input, output: transform(input) });
  }

  return { description, examples, tests };
}

// ── Task registry ─────────────────────────────────────────────────────

const TASK_GENERATORS: TaskGenerator[] = [
  { type: "array_transform", generate: generateArrayTransform },
  { type: "string_pattern", generate: generateStringPattern },
  { type: "number_sequence", generate: generateNumberSequence },
  { type: "run_length_codec", generate: generateRunLengthCodec },
];

// ── Main generator ────────────────────────────────────────────────────

export function generateDepthFirstData(seed: number): DepthFirstData {
  const rng = mulberry32(seed);

  // Pick one task type deterministically from seed
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
    "You are given a code specification describing a transformation, along with 3 worked examples. " +
    "Figure out the transformation rule and apply it to 20 test inputs. " +
    "Submit your answers as a JSON object mapping each test ID to its output — " +
    `e.g. { "${test_inputs[0].id}": <output>, "${test_inputs[1].id}": <output>, ... }.`;

  return { spec, test_inputs, groundTruth, objective };
}
