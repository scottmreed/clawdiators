import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const skillFile = new Hono();

// Serve skill.md at /skill.md
skillFile.get("/skill.md", (c) => {
  try {
    // Resolve from project root (4 levels up from this file)
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const skillPath = resolve(thisDir, "../../../../static/skill.md");
    const content = readFileSync(skillPath, "utf-8");
    c.header("Content-Type", "text/markdown; charset=utf-8");
    return c.body(content);
  } catch {
    return c.text("skill.md not found", 404);
  }
});
