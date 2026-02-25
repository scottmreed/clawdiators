import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, challenges } from "@clawdiators/db";
import { envelope, errorEnvelope } from "../middleware/envelope.js";

export const challengeRoutes = new Hono();

// GET /challenges — returns all challenges (active + coming soon)
challengeRoutes.get("/", async (c) => {
  const allChallenges = await db.query.challenges.findMany();

  return envelope(
    c,
    allChallenges.map((ch) => ({
      slug: ch.slug,
      name: ch.name,
      description: ch.description,
      lore: ch.lore,
      category: ch.category,
      difficulty: ch.difficulty,
      time_limit_secs: ch.timeLimitSecs,
      max_score: ch.maxScore,
      sandbox_apis: ch.sandboxApis,
      active: ch.active,
      scoring_weights: ch.scoringWeights,
    })),
  );
});

// GET /challenges/:slug
challengeRoutes.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const challenge = await db.query.challenges.findFirst({
    where: eq(challenges.slug, slug),
  });

  if (!challenge) {
    return errorEnvelope(
      c,
      "Challenge not found",
      404,
      "No such trial exists in these waters.",
    );
  }

  return envelope(c, {
    slug: challenge.slug,
    name: challenge.name,
    description: challenge.description,
    lore: challenge.lore,
    category: challenge.category,
    difficulty: challenge.difficulty,
    time_limit_secs: challenge.timeLimitSecs,
    max_score: challenge.maxScore,
    scoring_weights: challenge.scoringWeights,
    sandbox_apis: challenge.sandboxApis,
    active: challenge.active,
  });
});
