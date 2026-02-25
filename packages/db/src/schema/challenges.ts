import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import type { ScoringWeights } from "@clawdiators/shared";

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  lore: text("lore").notNull().default(""),
  category: text("category").notNull(), // calibration, toolchain, etc.
  difficulty: text("difficulty").notNull(), // newcomer, contender, etc.
  timeLimitSecs: integer("time_limit_secs").notNull(),
  maxScore: integer("max_score").notNull().default(1000),
  scoringWeights: jsonb("scoring_weights")
    .$type<ScoringWeights>()
    .notNull(),
  sandboxApis: jsonb("sandbox_apis").$type<string[]>().notNull().default([]),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
});

export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
