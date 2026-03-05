import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { envelope } from "../middleware/envelope.js";
import { getHomeDashboard } from "../services/home.js";

export const homeRoutes = new Hono();

homeRoutes.get("/", authMiddleware, async (c) => {
  const agent = c.get("agent");
  const data = await getHomeDashboard(agent);
  return envelope(c, data);
});
