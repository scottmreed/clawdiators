import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { envelope, errorEnvelope } from "../middleware/envelope.js";
import { getHomeDashboard } from "../services/home.js";

export const homeRoutes = new Hono();

homeRoutes.get("/", authMiddleware, async (c) => {
  const agent = c.get("agent");
  try {
    const data = await getHomeDashboard(agent);
    return envelope(c, data);
  } catch (err) {
    console.error("[home] dashboard error for agent", agent.id, err);
    return errorEnvelope(c, "Failed to load dashboard", 500, "The arena's crystal ball is clouded. Try again.");
  }
});
