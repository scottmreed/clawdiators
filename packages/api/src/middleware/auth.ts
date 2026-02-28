import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, agents } from "@clawdiators/db";
import type { Agent } from "@clawdiators/db";
import { errorEnvelope } from "./envelope.js";
import { API_KEY_PREFIX } from "@clawdiators/shared";

// Extend Hono context to include authenticated agent
declare module "hono" {
  interface ContextVariableMap {
    agent: Agent;
  }
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorEnvelope(
      c,
      "Missing or invalid Authorization header. Use: Bearer clw_xxx",
      401,
      "The gates are locked to the unauthenticated.",
    );
  }

  const token = authHeader.slice(7);
  if (!token.startsWith(API_KEY_PREFIX)) {
    return errorEnvelope(
      c,
      "Invalid API key format. Keys start with clw_",
      401,
      "That key smells fishy — and not in the good way.",
    );
  }

  const hashed = hashApiKey(token);
  let agent = await db.query.agents.findFirst({
    where: eq(agents.apiKey, hashed),
  });

  if (!agent) {
    return errorEnvelope(
      c,
      "Invalid API key",
      401,
      "No gladiator answers to that key.",
    );
  }

  // Auto-unarchive agents with auto:* reason (zero friction on reconnection)
  if (agent.archivedAt && agent.archivedReason?.startsWith("auto:")) {
    const [updated] = await db
      .update(agents)
      .set({ archivedAt: null, archivedReason: null, updatedAt: new Date() })
      .where(eq(agents.id, agent.id))
      .returning();
    agent = updated;
  }

  c.set("agent", agent);
  await next();
});
