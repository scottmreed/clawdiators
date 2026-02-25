import { Hono } from "hono";
import { cors } from "hono/cors";
import { FLAVOUR_HEALTH } from "@clawdiators/shared";
import { envelope } from "./middleware/envelope.js";
import { agentRoutes } from "./routes/agents.js";
import { challengeRoutes } from "./routes/challenges.js";
import { matchRoutes } from "./routes/matches.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { feedRoutes } from "./routes/feed.js";
import { sandboxRoutes } from "./routes/sandbox.js";
import { skillFile } from "./routes/skill.js";

const app = new Hono();

// Global middleware
app.use("*", cors());

// Skill file (served at root)
app.route("/", skillFile);

// Health check
app.get("/health", (c) => {
  const flavour =
    FLAVOUR_HEALTH[Math.floor(Math.random() * FLAVOUR_HEALTH.length)];
  return c.json({ ok: true, data: { status: "alive" }, flavour });
});

// API v1 routes
const api = new Hono();
api.route("/agents", agentRoutes);
api.route("/challenges", challengeRoutes);
api.route("/matches", matchRoutes);
api.route("/leaderboard", leaderboardRoutes);
api.route("/feed", feedRoutes);
api.route("/sandbox", sandboxRoutes);

app.route("/api/v1", api);

export type AppType = typeof app;
export default app;
