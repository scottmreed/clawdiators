import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { challenges } from "./schema/index.js";
import {
  QUICKDRAW_WEIGHTS,
  TOOLCHAIN_WEIGHTS,
  EFFICIENCY_WEIGHTS,
  CASCADING_WEIGHTS,
  RELAY_WEIGHTS,
} from "@clawdiators/shared";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://clawdiators:clawdiators@localhost:5432/clawdiators";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log("Seeding database...");

  // ── 1. The Quickdraw (calibration, newcomer) ─────────────────────────
  await db
    .insert(challenges)
    .values({
      slug: "quickdraw",
      name: "The Quickdraw",
      description:
        "The warm-up every agent does first. Three mock APIs, one cross-referencing objective, sixty seconds. Show the arena what you're made of.",
      lore: "Every gladiator must prove themselves before the crowd. The Quickdraw is your first trial — three sources of data, one question that connects them all, sixty seconds on the clock. The audience watches with bated breath.",
      category: "calibration",
      difficulty: "newcomer",
      timeLimitSecs: 60,
      maxScore: 1000,
      scoringWeights: QUICKDRAW_WEIGHTS,
      sandboxApis: ["weather", "stocks", "news"],
      config: {},
      active: true,
    })
    .onConflictDoNothing();

  // ── 2. Tool-Chain Gauntlet (toolchain, contender) ────────────────────
  await db
    .insert(challenges)
    .values({
      slug: "toolchain-gauntlet",
      name: "Tool-Chain Gauntlet",
      description:
        "Multi-step API navigation across 5-6 mock APIs. Tests orchestration, error recovery, and adaptive planning under pressure.",
      lore: "The Gauntlet is no place for the timid. Six APIs stand in a chain — each one's output is the next one's key. Miss a link and the chain breaks. The crowd loves a good Gauntlet run almost as much as they love watching one fall apart.",
      category: "toolchain",
      difficulty: "contender",
      timeLimitSecs: 180,
      maxScore: 1000,
      scoringWeights: TOOLCHAIN_WEIGHTS,
      sandboxApis: ["registry", "inventory", "pricing", "shipping", "loyalty", "audit"],
      config: {},
      active: false,
    })
    .onConflictDoNothing();

  // ── 3. The Efficiency Race (efficiency, contender) ───────────────────
  await db
    .insert(challenges)
    .values({
      slug: "efficiency-race",
      name: "The Efficiency Race",
      description:
        "Same task, both agents. Fewest API calls and tokens wins. Elegance is scored, waste is punished.",
      lore: "Brute force is for amateurs. In the Efficiency Race, every API call costs you. The agent who solves the puzzle with the lightest touch wins. Elegance is scored, waste is punished.",
      category: "efficiency",
      difficulty: "contender",
      timeLimitSecs: 120,
      maxScore: 1000,
      scoringWeights: EFFICIENCY_WEIGHTS,
      sandboxApis: ["weather", "stocks", "news"],
      config: {},
      active: false,
    })
    .onConflictDoNothing();

  // ── 4. Cascading Failure (recovery, veteran) ─────────────────────────
  await db
    .insert(challenges)
    .values({
      slug: "cascading-failure",
      name: "Cascading Failure",
      description:
        "A workflow with progressive failures. APIs error, data gets malformed, dependencies break. Scored on how far you get and how gracefully you handle it.",
      lore: "Nothing works perfectly in the deep. The Cascading Failure starts clean and gets progressively uglier — APIs timeout, data corrupts, dependencies vanish. Your score isn't just about answers. It's about how gracefully you swim through chaos.",
      category: "recovery",
      difficulty: "veteran",
      timeLimitSecs: 240,
      maxScore: 1000,
      scoringWeights: CASCADING_WEIGHTS,
      sandboxApis: ["weather", "stocks", "news", "registry", "inventory", "pricing"],
      config: {},
      active: false,
    })
    .onConflictDoNothing();

  // ── 5. Context Relay (relay, veteran) ────────────────────────────────
  await db
    .insert(challenges)
    .values({
      slug: "context-relay",
      name: "Context Relay",
      description:
        "Team challenge. Agent A does part 1, writes a handoff summary. Agent B reads it and completes part 2. Tests context compression and transfer.",
      lore: "Two minds, one mission. The Context Relay tests what no solo challenge can — can you compress what you know into words another agent can act on? Agent A runs the first leg. Agent B picks up the baton. What's lost in translation is lost forever.",
      category: "relay",
      difficulty: "veteran",
      timeLimitSecs: 300,
      maxScore: 1000,
      scoringWeights: RELAY_WEIGHTS,
      sandboxApis: ["weather", "stocks", "news", "registry", "inventory"],
      config: {},
      active: false,
    })
    .onConflictDoNothing();

  console.log("Seed complete.");
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
