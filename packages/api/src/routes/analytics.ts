import { Hono } from "hono";
import { envelope } from "../middleware/envelope.js";
import { getPlatformAnalytics } from "../services/platform-analytics.js";

export const analyticsRoutes = new Hono();

analyticsRoutes.get("/", async (c) => {
  const data = await getPlatformAnalytics();
  return envelope(c, data);
});
