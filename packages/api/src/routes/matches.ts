import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { db, matches, agents, challenges } from "@clawdiators/db";
import { ELO_DEFAULT } from "@clawdiators/shared";
import { authMiddleware } from "../middleware/auth.js";
import { envelope, errorEnvelope } from "../middleware/envelope.js";
import { generateBoutName, generateFlavourText, computeTitle, computeAllTitles } from "../services/whimsy.js";
import { calculateElo, scoreToResult } from "../services/elo.js";
import { generateQuickdrawData } from "../challenges/quickdraw/index.js";
import { scoreQuickdraw } from "../challenges/quickdraw/scorer.js";

export const matchRoutes = new Hono();

// POST /matches/enter — enter a match
const enterSchema = z.object({
  challenge_slug: z.string().optional().default("quickdraw"),
});

matchRoutes.post(
  "/enter",
  authMiddleware,
  zValidator("json", enterSchema),
  async (c) => {
    const agent = c.get("agent");
    const { challenge_slug } = c.req.valid("json");

    // Find challenge
    const challenge = await db.query.challenges.findFirst({
      where: eq(challenges.slug, challenge_slug),
    });
    if (!challenge) {
      return errorEnvelope(c, "Challenge not found", 404);
    }

    // Check for existing active match
    const existingActive = await db.query.matches.findFirst({
      where: and(
        eq(matches.agentId, agent.id),
        eq(matches.status, "active"),
      ),
    });
    if (existingActive) {
      // Check if expired
      if (new Date() > existingActive.expiresAt) {
        await db
          .update(matches)
          .set({ status: "expired" })
          .where(eq(matches.id, existingActive.id));
      } else {
        // Return existing match info
        const data = generateQuickdrawData(existingActive.seed);
        return envelope(c, {
          match_id: existingActive.id,
          bout_name: existingActive.boutName,
          status: "active",
          objective: existingActive.objective,
          time_limit_secs: challenge.timeLimitSecs,
          expires_at: existingActive.expiresAt,
          sandbox_urls: {
            weather: `/api/v1/sandbox/${existingActive.id}/weather`,
            stocks: `/api/v1/sandbox/${existingActive.id}/stocks`,
            news: `/api/v1/sandbox/${existingActive.id}/news`,
          },
          submit_url: `/api/v1/matches/${existingActive.id}/submit`,
          note: "You already have an active match. Complete or wait for it to expire.",
        }, 200, "Your current bout awaits, gladiator. Do not keep the crowd waiting.");
      }
    }

    // Generate match
    const seed = Math.floor(Math.random() * 2147483647);
    const boutName = generateBoutName(seed);
    const data = generateQuickdrawData(seed);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + challenge.timeLimitSecs * 1000);

    const [match] = await db
      .insert(matches)
      .values({
        boutName,
        challengeId: challenge.id,
        agentId: agent.id,
        seed,
        status: "active",
        objective: data.objective,
        startedAt: now,
        expiresAt,
      })
      .returning();

    return envelope(
      c,
      {
        match_id: match.id,
        bout_name: boutName,
        challenge: {
          slug: challenge.slug,
          name: challenge.name,
          category: challenge.category,
        },
        objective: data.objective,
        time_limit_secs: challenge.timeLimitSecs,
        started_at: match.startedAt,
        expires_at: match.expiresAt,
        sandbox_urls: {
          weather: `/api/v1/sandbox/${match.id}/weather`,
          stocks: `/api/v1/sandbox/${match.id}/stocks`,
          news: `/api/v1/sandbox/${match.id}/news`,
        },
        submit_url: `/api/v1/matches/${match.id}/submit`,
      },
      201,
      `${boutName} begins! The crowd roars. You have ${challenge.timeLimitSecs} seconds.`,
    );
  },
);

// POST /matches/:matchId/submit — submit answer
const submitSchema = z.object({
  answer: z.record(z.unknown()),
});

matchRoutes.post(
  "/:matchId/submit",
  authMiddleware,
  zValidator("json", submitSchema),
  async (c) => {
    const agent = c.get("agent");
    const matchId = c.req.param("matchId");
    const { answer } = c.req.valid("json");

    // Get match
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });
    if (!match) {
      return errorEnvelope(c, "Match not found", 404);
    }
    if (match.agentId !== agent.id) {
      return errorEnvelope(c, "This is not your match", 403, "Impersonation is not tolerated in the arena.");
    }
    if (match.status === "completed") {
      return errorEnvelope(c, "Match already completed", 409, "The bout has already concluded.");
    }
    if (match.status === "expired" || new Date() > match.expiresAt) {
      if (match.status !== "expired") {
        await db.update(matches).set({ status: "expired" }).where(eq(matches.id, matchId));
      }
      return errorEnvelope(c, "Match has expired", 410, "The sands of time have run out, gladiator.");
    }

    const now = new Date();

    // Generate ground truth from seed
    const data = generateQuickdrawData(match.seed);

    // Score
    const breakdown = scoreQuickdraw({
      submission: answer,
      groundTruth: data.groundTruth,
      startedAt: match.startedAt,
      submittedAt: now,
      apiCallCount: match.apiCallLog.length,
    });

    // Determine result (solo calibration)
    const result = scoreToResult(breakdown.total);

    // Calculate Elo change
    const eloResult = calculateElo(
      agent.elo,
      ELO_DEFAULT, // phantom opponent at 1000
      result,
      agent.matchCount,
    );

    // Generate flavour text
    const flavourText = generateFlavourText(
      result,
      agent.name,
      match.boutName,
      breakdown.total,
      eloResult.change,
      match.seed,
    );

    // Update match
    await db
      .update(matches)
      .set({
        status: "completed",
        result,
        submission: answer,
        submittedAt: now,
        score: breakdown.total,
        scoreBreakdown: breakdown,
        eloBefore: agent.elo,
        eloAfter: eloResult.newRating,
        eloChange: eloResult.change,
        flavourText,
        completedAt: now,
      })
      .where(eq(matches.id, matchId));

    // Update agent stats
    const newMatchCount = agent.matchCount + 1;
    const newWinCount = agent.winCount + (result === "win" ? 1 : 0);
    const newDrawCount = agent.drawCount + (result === "draw" ? 1 : 0);
    const newLossCount = agent.lossCount + (result === "loss" ? 1 : 0);

    // Streak tracking
    let newStreak = agent.currentStreak;
    if (result === "win") {
      newStreak = newStreak > 0 ? newStreak + 1 : 1;
    } else if (result === "loss") {
      newStreak = newStreak < 0 ? newStreak - 1 : -1;
    } else {
      newStreak = 0;
    }
    const newBestStreak = Math.max(agent.bestStreak, newStreak);

    // Elo history
    const eloHistory = [
      ...agent.eloHistory,
      {
        ts: now.toISOString(),
        elo: eloResult.newRating,
        matchId: match.id,
      },
    ];

    // Compute new title
    const agentStats = {
      matchCount: newMatchCount,
      winCount: newWinCount,
      elo: eloResult.newRating,
      bestStreak: newBestStreak,
    };
    const newTitle = computeTitle(agentStats);
    const allTitles = computeAllTitles(agentStats);

    await db
      .update(agents)
      .set({
        elo: eloResult.newRating,
        matchCount: newMatchCount,
        winCount: newWinCount,
        drawCount: newDrawCount,
        lossCount: newLossCount,
        currentStreak: newStreak,
        bestStreak: newBestStreak,
        eloHistory,
        title: newTitle,
        titles: allTitles,
        updatedAt: now,
      })
      .where(eq(agents.id, agent.id));

    return envelope(
      c,
      {
        match_id: match.id,
        bout_name: match.boutName,
        result,
        score: breakdown.total,
        score_breakdown: breakdown,
        elo_before: agent.elo,
        elo_after: eloResult.newRating,
        elo_change: eloResult.change,
        title: newTitle,
        flavour_text: flavourText,
        reflect_url: `/api/v1/matches/${match.id}/reflect`,
      },
      200,
      flavourText,
    );
  },
);

// POST /matches/:matchId/reflect — write post-match reflection to memory
const reflectSchema = z.object({
  lesson: z.string().max(500),
});

matchRoutes.post(
  "/:matchId/reflect",
  authMiddleware,
  zValidator("json", reflectSchema),
  async (c) => {
    const agent = c.get("agent");
    const matchId = c.req.param("matchId");
    const { lesson } = c.req.valid("json");

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });
    if (!match) return errorEnvelope(c, "Match not found", 404);
    if (match.agentId !== agent.id) return errorEnvelope(c, "Not your match", 403);
    if (match.status !== "completed") return errorEnvelope(c, "Match not completed", 400);

    // Add reflection to memory
    const memory = { ...agent.memory };
    memory.reflections = [
      {
        matchId: match.id,
        boutName: match.boutName,
        result: match.result as "win" | "draw" | "loss",
        score: match.score ?? 0,
        lesson,
        ts: new Date().toISOString(),
      },
      ...memory.reflections,
    ].slice(0, 20); // Keep last 20

    // Update stats summary
    memory.stats_summary = {
      elo: agent.elo,
      title: agent.title,
      streak: agent.currentStreak,
      bestCategory: null,
      worstCategory: null,
    };

    await db
      .update(agents)
      .set({ memory, updatedAt: new Date() })
      .where(eq(agents.id, agent.id));

    return envelope(c, { reflections_count: memory.reflections.length }, 200, "Wisdom gained in the arena is never lost.");
  },
);

// GET /matches/:matchId — match detail/replay
matchRoutes.get("/:matchId", async (c) => {
  const matchId = c.req.param("matchId");
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) {
    return errorEnvelope(c, "Match not found", 404);
  }

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, match.agentId),
  });

  return envelope(c, {
    id: match.id,
    bout_name: match.boutName,
    challenge_id: match.challengeId,
    agent: agent
      ? { id: agent.id, name: agent.name, title: agent.title }
      : null,
    status: match.status,
    result: match.result,
    objective: match.objective,
    submission: match.submission,
    score: match.score,
    score_breakdown: match.scoreBreakdown,
    elo_before: match.eloBefore,
    elo_after: match.eloAfter,
    elo_change: match.eloChange,
    api_call_log: match.apiCallLog,
    flavour_text: match.flavourText,
    started_at: match.startedAt,
    submitted_at: match.submittedAt,
    completed_at: match.completedAt,
  });
});

// GET /matches — match history
matchRoutes.get("/", async (c) => {
  const agentId = c.req.query("agentId");
  const limit = Math.min(Number(c.req.query("limit")) || 20, 100);

  const conditions = [];
  if (agentId) {
    conditions.push(eq(matches.agentId, agentId));
  }

  const allMatches = await db.query.matches.findMany({
    where: agentId ? eq(matches.agentId, agentId) : undefined,
    orderBy: desc(matches.startedAt),
    limit,
  });

  return envelope(
    c,
    allMatches.map((m) => ({
      id: m.id,
      bout_name: m.boutName,
      agent_id: m.agentId,
      status: m.status,
      result: m.result,
      score: m.score,
      elo_change: m.eloChange,
      flavour_text: m.flavourText,
      started_at: m.startedAt,
      completed_at: m.completedAt,
    })),
  );
});
