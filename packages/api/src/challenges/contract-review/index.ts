import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { CONTRACT_REVIEW_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateContractData } from "./data.js";
import { scoreContract } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateContractData } from "./data.js";
export { scoreContract } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateContractData(match.seed);
  return { match, data };
}

async function logApiCall(
  matchId: string,
  currentLog: ApiCallLogEntry[],
  method: string,
  path: string,
  status: number,
  startTime: number,
) {
  const entry: ApiCallLogEntry = {
    ts: new Date().toISOString(),
    method,
    path,
    status,
    durationMs: Date.now() - startTime,
  };
  await db
    .update(matches)
    .set({ apiCallLog: [...currentLog, entry] })
    .where(eq(matches.id, matchId));
}

// ── ChallengeModule implementation ───────────────────────────────────

export const contractReviewModule: ChallengeModule = {
  slug: "contract-review",
  dimensions: CONTRACT_REVIEW_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateContractData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      sections: data.sections.map(s => ({ id: s.id, title: s.title })),
      definitions: data.definitions,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreContract(input);
  },

  sandboxApiNames(): string[] {
    return ["contract", "definitions"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/contract — returns section list (id + title only) or search results
    sandbox.get("/:matchId/contract", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The contract has dissolved into the abyss.");
      }

      const searchTerm = c.req.query("search");

      if (searchTerm) {
        // Search: return sections containing the search term with matching clause excerpts
        const query = searchTerm.toLowerCase();
        const matches: Array<{ id: string; title: string; matching_clauses: string[] }> = [];

        for (const section of result.data.sections) {
          const matchingClauses: string[] = [];
          for (const clause of section.clauses) {
            if (clause.toLowerCase().includes(query)) {
              matchingClauses.push(clause);
            }
          }
          if (matchingClauses.length > 0) {
            matches.push({
              id: section.id,
              title: section.title,
              matching_clauses: matchingClauses,
            });
          }
        }

        await logApiCall(matchId, result.match.apiCallLog, "GET",
          `/sandbox/${matchId}/contract?search=${encodeURIComponent(searchTerm)}`, 200, startTime);

        return c.json({
          query: searchTerm,
          results: matches,
          total_matches: matches.length,
        });
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/contract`, 200, startTime);

      return c.json({
        sections: result.data.sections.map(s => ({ id: s.id, title: s.title })),
        total_sections: result.data.sections.length,
        instructions: "Use GET /:matchId/contract/:sectionId to read individual sections. Use GET /:matchId/definitions for defined terms. Use ?search=term to find sections containing a specific term.",
      });
    });

    // GET /:matchId/contract/:sectionId — returns full section with clauses
    sandbox.get("/:matchId/contract/:sectionId", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const sectionId = c.req.param("sectionId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The contract has dissolved into the abyss.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/contract/${sectionId}`, 200, startTime);

      const section = result.data.sections.find(s => s.id === sectionId);
      if (!section) {
        return c.json({
          error: "Section not found",
          available_ids: result.data.sections.map(s => s.id),
        }, 404);
      }

      return c.json({
        id: section.id,
        title: section.title,
        clauses: section.clauses,
        clause_count: section.clauses.length,
      });
    });

    // GET /:matchId/definitions — returns all defined terms
    sandbox.get("/:matchId/definitions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The contract has dissolved into the abyss.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/definitions`, 200, startTime);

      return c.json({
        definitions: result.data.definitions,
        total: result.data.definitions.length,
      });
    });

    return sandbox;
  },
};
