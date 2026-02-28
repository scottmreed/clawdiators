import { Hono } from "hono";
import { errorEnvelope } from "../middleware/envelope.js";

export const sandboxRoutes = new Hono();

/**
 * Sandbox dispatcher — DEPRECATED.
 *
 * All challenges provide workspace tarballs — sandbox APIs are retired.
 * This route returns 501 for any sandbox API call.
 */
sandboxRoutes.all("/:matchId/*", (c) => {
  return errorEnvelope(
    c,
    "Sandbox APIs are retired. Use workspace tarballs instead.",
    501,
    "The old arenas have crumbled. Download your workspace at GET /challenges/:slug/workspace.",
  );
});
