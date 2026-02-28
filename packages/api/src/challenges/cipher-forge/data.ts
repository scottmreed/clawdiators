import { mulberry32 } from "../../services/whimsy.js";

export interface CipherMessage {
  id: string;
  difficulty: number; // 1-5
  cipher_type: string;
  encrypted_text: string;
  hint: string;
}

export interface CipherGroundTruth {
  messages: Array<{
    id: string;
    plaintext: string;
    cipher_type: string;
    key: string | number;
    difficulty: number;
  }>;
}

export interface CipherData {
  messages: CipherMessage[];
  reference_table: Record<string, string>;
  groundTruth: CipherGroundTruth;
  objective: string;
}

const PHRASES = [
  "the arena demands precision from every challenger who enters",
  "every claw sharpens through practice in the deepest training grounds",
  "deep waters hold ancient secrets waiting to be discovered below",
  "victory always favors the mind that prepares before the battle",
  "the rising tide reveals hidden patterns along the ocean floor",
  "true strength lies in the ability to adapt and overcome",
  "knowledge remains the sharpest weapon in any arena of combat",
  "patience wins even the longest and most grueling of battles",
  "the living reef conceals great treasure within its coral chambers",
  "swift and dangerous currents will test only the truly worthy",
  "only the wise and the cunning survive the crushing deep",
  "courage and determination open every locked gate in the fortress",
  "the pale moon guides all night hunters safely through darkness",
  "an eerie silence falls before the great ocean storm strikes",
  "trust your instincts when swimming through unfamiliar dark waters",
  "the coral fortress stands guard against all intruders from above",
  "ancient leviathans patrol the deepest trenches searching for worthy prey",
  "champions are forged in the fires of endless underwater competition",
  "the kraken awakens only when trespassers breach the sacred boundary",
  "bioluminescent creatures illuminate the dark path through the abyssal waters",
  "the golden trident commands respect and fear from every challenger",
  "whirlpools of fate drag the unprepared down into silent oblivion",
  "the seahorse cavalry charges across the sandy battlefield before dawn",
  "barnacles of doubt must be scraped clean away from the hull",
  "the heavy anchor holds firm against the raging undersea tempest",
  "jellyfish lanterns float gently through the midnight current and glow",
  "the sunken shipwreck graveyard tells tales of forgotten epic voyages",
  "brave pearl divers risk everything for a single precious gem",
  "the clever octopus strategist always plans eight moves ahead of rivals",
  "starfish sentinels cling to the rocky outpost and watch silently",
  "the hermit crab carries its armored fortress wherever it travels",
  "razor sharp coral edges punish all those who swim carelessly",
  "the anglerfish lures its prey with a deceptive glowing light",
  "massive tidal waves reshape the coastline after every fierce battle",
  "the ancient nautilus spirals downward into chambers of lost knowledge",
  "electric eels guard the narrow passage between the rival territories",
  "the mantis shrimp strikes with a force no armor withstands",
  "sea urchins form a defensive spiny wall across the open ground",
  "the haunting whale song carries warnings across the vast ocean basin",
  "underwater volcanoes forge new islands from rivers of molten stone",
  "the gladiator of the deep raises a claw in open defiance",
  "no current is too strong for those who train without ceasing",
  "beneath the surface lies a hidden world of strategy and deception",
  "the arena floor is littered with the shells of defeated challengers",
  "only those who master the tides can ever claim the throne",
  "the abyssal plain stretches endlessly far beyond all reach of sunlight",
  "predators circle above while the clever ones hide among the kelp",
  "the great barrier holds secrets that no single explorer has uncovered",
  "legends speak of a golden weapon buried beneath the volcanic ridge",
  "the current champion earned that title through years of brutal combat",
  "a school of warriors moves together as one against approaching threats",
  "the crushing pressure increases with every fathom descended into cold darkness",
  "phosphorescent plankton trace the movements of every creature in the water",
  "the siren call draws many travelers but only the strongest resist",
  "ancient maps carved in stone reveal passages through the underwater labyrinth",
  "the colosseum of coral hosts tournaments that echo throughout the ages",
  "challenger and champion finally meet where the fading light disappears completely",
  "the deep submarine canyon holds great tactical advantage for those prepared",
  "tentacles of the giant squid can crush even the strongest armor",
  "the moray eel waits motionless in its crevice for the perfect strike",
  "volcanic thermal vents provide warmth and energy to creatures of the abyss",
  "the hammerhead patrols sensing distant vibrations rippling from across the reef",
  "a single drop of potent venom from the blue ringed octopus",
  "the tide pool arena is small but the combat within is fierce",
  "survivors of the deep trench carry scars that tell their true story",
];

const ALPHA = "abcdefghijklmnopqrstuvwxyz";

function caesarEncrypt(text: string, shift: number): string {
  return text.split("").map((ch) => {
    const idx = ALPHA.indexOf(ch);
    if (idx === -1) return ch;
    return ALPHA[(idx + shift) % 26];
  }).join("");
}

function substitutionEncrypt(text: string, rng: () => number): { encrypted: string; key: string } {
  const shuffled = [...ALPHA];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const key = shuffled.join("");
  const encrypted = text.split("").map((ch) => {
    const idx = ALPHA.indexOf(ch);
    if (idx === -1) return ch;
    return key[idx];
  }).join("");
  return { encrypted, key };
}

function vigenereEncrypt(text: string, keyword: string): string {
  let keyIdx = 0;
  return text.split("").map((ch) => {
    const idx = ALPHA.indexOf(ch);
    if (idx === -1) return ch;
    const shift = ALPHA.indexOf(keyword[keyIdx % keyword.length]);
    keyIdx++;
    return ALPHA[(idx + shift) % 26];
  }).join("");
}

function columnarEncrypt(text: string, columns: number): string {
  const rows: string[][] = [];
  for (let i = 0; i < text.length; i += columns) {
    rows.push(text.slice(i, i + columns).split(""));
  }
  while (rows[rows.length - 1].length < columns) {
    rows[rows.length - 1].push("x");
  }
  let result = "";
  for (let col = 0; col < columns; col++) {
    for (const row of rows) {
      result += row[col];
    }
  }
  return result;
}

function railFenceEncrypt(text: string, rails: number): string {
  if (rails <= 1) return text;
  const fence: string[][] = Array.from({ length: rails }, () => []);
  let rail = 0;
  let direction = 1;
  for (const ch of text) {
    fence[rail].push(ch);
    if (rail === 0) direction = 1;
    if (rail === rails - 1) direction = -1;
    rail += direction;
  }
  return fence.map((r) => r.join("")).join("");
}

function routeCipherEncrypt(text: string, columns: number): string {
  const rows: string[][] = [];
  for (let i = 0; i < text.length; i += columns) {
    rows.push(text.slice(i, i + columns).split(""));
  }
  while (rows[rows.length - 1].length < columns) {
    rows[rows.length - 1].push("x");
  }
  let result = "";
  for (let col = 0; col < columns; col++) {
    if (col % 2 === 0) {
      for (let row = 0; row < rows.length; row++) {
        result += rows[row][col];
      }
    } else {
      for (let row = rows.length - 1; row >= 0; row--) {
        result += rows[row][col];
      }
    }
  }
  return result;
}

function reverseBlockEncrypt(text: string, blockSize: number): string {
  let result = "";
  for (let i = 0; i < text.length; i += blockSize) {
    result += text.slice(i, i + blockSize).split("").reverse().join("");
  }
  return result;
}

function combinedEncrypt(text: string, rng: () => number): { encrypted: string; key: string } {
  const shift = Math.floor(rng() * 20) + 3;
  const keywords = ["reef", "claw", "tide", "deep", "wave"];
  const keyword = keywords[Math.floor(rng() * keywords.length)];
  const afterCaesar = caesarEncrypt(text, shift);
  const afterVigenere = vigenereEncrypt(afterCaesar, keyword);
  return { encrypted: afterVigenere, key: `caesar:${shift}+vigenere:${keyword}` };
}

export function generateCipherData(seed: number): CipherData {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const shuffled = [...PHRASES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selected = shuffled.slice(0, 5);

  const messages: CipherMessage[] = [];
  const truthMessages: CipherGroundTruth["messages"] = [];

  // 1. Caesar cipher (difficulty 1)
  const caesarShift = randInt(3, 20);
  const caesar = caesarEncrypt(selected[0], caesarShift);
  messages.push({
    id: `cipher-${seed}-1`,
    difficulty: 1,
    cipher_type: "caesar",
    encrypted_text: caesar,
    hint: "A classic rotation cipher. The alphabet has been shifted by a constant amount.",
  });
  truthMessages.push({
    id: `cipher-${seed}-1`,
    plaintext: selected[0],
    cipher_type: "caesar",
    key: String(caesarShift),
    difficulty: 1,
  });

  // 2. Substitution cipher (difficulty 2)
  const sub = substitutionEncrypt(selected[1], rng);
  messages.push({
    id: `cipher-${seed}-2`,
    difficulty: 2,
    cipher_type: "substitution",
    encrypted_text: sub.encrypted,
    hint: "Each letter maps to exactly one other letter. Frequency analysis may help.",
  });
  truthMessages.push({
    id: `cipher-${seed}-2`,
    plaintext: selected[1],
    cipher_type: "substitution",
    key: sub.key,
    difficulty: 2,
  });

  // 3. Vigenere cipher (difficulty 3)
  const vKeywords = ["reef", "claw", "tide", "deep", "wave", "coral", "shell"];
  const vKey = pick(vKeywords);
  const vig = vigenereEncrypt(selected[2], vKey);
  messages.push({
    id: `cipher-${seed}-3`,
    difficulty: 3,
    cipher_type: "vigenere",
    encrypted_text: vig,
    hint: "A polyalphabetic substitution cipher.",
  });
  truthMessages.push({
    id: `cipher-${seed}-3`,
    plaintext: selected[2],
    cipher_type: "vigenere",
    key: vKey,
    difficulty: 3,
  });

  // 4. Transposition cipher (difficulty 4) — one of four variants
  const plainNoSpaces = selected[3].replace(/ /g, "");
  const transRoll = rng();
  let transEncrypted: string;
  let transKey: string;
  let transHint: string;

  if (transRoll < 0.25) {
    const rails = randInt(3, 5);
    transEncrypted = railFenceEncrypt(plainNoSpaces, rails);
    transKey = `railfence:${rails}`;
    transHint = "Letters were rearranged according to a geometric traversal pattern. No letters were changed.";
  } else if (transRoll < 0.5) {
    const cols = randInt(3, 6);
    transEncrypted = columnarEncrypt(plainNoSpaces, cols);
    transKey = `columnar:${cols}`;
    transHint = "Letters were rearranged using a grid-based method. Padding may have been added. No letters were changed.";
  } else if (transRoll < 0.75) {
    const cols = randInt(3, 6);
    transEncrypted = routeCipherEncrypt(plainNoSpaces, cols);
    transKey = `route:${cols}`;
    transHint = "A custom route transposition cipher. See the challenge description for the encoding algorithm. No letters were changed, only rearranged.";
  } else {
    const blockSize = randInt(3, 6);
    transEncrypted = reverseBlockEncrypt(plainNoSpaces, blockSize);
    transKey = `reverseblock:${blockSize}`;
    transHint = "The text was divided into fixed-size segments and each segment was internally rearranged. No letters were changed.";
  }

  messages.push({
    id: `cipher-${seed}-4`,
    difficulty: 4,
    cipher_type: "transposition",
    encrypted_text: transEncrypted,
    hint: transHint,
  });
  truthMessages.push({
    id: `cipher-${seed}-4`,
    plaintext: plainNoSpaces,
    cipher_type: "transposition",
    key: transKey,
    difficulty: 4,
  });

  // 5. Combined cipher (difficulty 5)
  const combined = combinedEncrypt(selected[4], rng);
  messages.push({
    id: `cipher-${seed}-5`,
    difficulty: 5,
    cipher_type: "combined",
    encrypted_text: combined.encrypted,
    hint: "Multiple cipher operations were applied.",
  });
  truthMessages.push({
    id: `cipher-${seed}-5`,
    plaintext: selected[4],
    cipher_type: "combined",
    key: combined.key,
    difficulty: 5,
  });

  const referenceTable: Record<string, string> = {
    most_common: "e, t, a, o, i, n, s, h, r",
    least_common: "z, q, x, j, k",
    common_bigrams: "th, he, in, er, an, re, on, at",
    common_words: "the, of, and, to, in, is, it, for",
  };

  const ids = messages.map(m => m.id);
  const objective =
    `Decrypt all 5 encrypted messages. Each uses a progressively harder cipher. Submit the plaintext for each message ID. A reference table of English letter frequencies is provided.\n\nExpected submission format:\n{"answer": {"${ids[0]}": "decrypted text", "${ids[1]}": "decrypted text", "${ids[2]}": "decrypted text", "${ids[3]}": "decrypted text", "${ids[4]}": "decrypted text"}}`;

  return {
    messages,
    reference_table: referenceTable,
    groundTruth: { messages: truthMessages },
    objective,
  };
}
