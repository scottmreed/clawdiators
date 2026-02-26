import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, matches } from "@clawdiators/db";
import { ARCHIVE_DIVE_DIMENSIONS } from "@clawdiators/shared";
import type { ApiCallLogEntry } from "@clawdiators/shared";
import type { ChallengeModule, ChallengeData, ScoringInput, ScoreResult } from "../types.js";
import { generateArchiveData } from "./data.js";
import { scoreArchive } from "./scorer.js";
import { errorEnvelope } from "../../middleware/envelope.js";

export { generateArchiveData } from "./data.js";
export { scoreArchive } from "./scorer.js";

// ── Sandbox helpers ──────────────────────────────────────────────────

async function getMatchAndData(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return null;
  if (match.status !== "active") return null;
  if (new Date() > match.expiresAt) return null;
  const data = generateArchiveData(match.seed);
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

export const archiveDiveModule: ChallengeModule = {
  slug: "archive-dive",
  dimensions: ARCHIVE_DIVE_DIMENSIONS,

  generateData(seed: number, _config: Record<string, unknown>): ChallengeData {
    const data = generateArchiveData(seed);
    return {
      objective: data.objective,
      groundTruth: data.groundTruth as unknown as Record<string, unknown>,
      documents: data.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        author: doc.author,
        keywords: doc.keywords,
        page_count: doc.pages.length,
      })),
      questions: data.questions,
    };
  },

  score(input: ScoringInput): ScoreResult {
    return scoreArchive(input);
  },

  sandboxApiNames(): string[] {
    return ["documents", "search", "questions"];
  },

  sandboxRoutes(): Hono {
    const sandbox = new Hono();

    // GET /:matchId/documents — returns document list (metadata only, no full text)
    sandbox.get("/:matchId/documents", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The archive is sealed.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/documents`, 200, startTime);

      const listing = result.data.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        author: doc.author,
        keywords: doc.keywords,
        page_count: doc.pages.length,
      }));

      return c.json({
        documents: listing,
        total: listing.length,
      });
    });

    // GET /:matchId/documents/:docId — returns single page of a document (paginated)
    sandbox.get("/:matchId/documents/:docId", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const docId = c.req.param("docId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The archive is sealed.");
      }

      const doc = result.data.documents.find((d) => d.id === docId);
      if (!doc) {
        await logApiCall(matchId, result.match.apiCallLog, "GET",
          `/sandbox/${matchId}/documents/${docId}`, 404, startTime);
        return errorEnvelope(c, "Document not found", 404, "No such scroll in the archive.");
      }

      const pageParam = c.req.query("page");
      const pageNum = pageParam ? parseInt(pageParam, 10) : 1;

      if (isNaN(pageNum) || pageNum < 1 || pageNum > doc.pages.length) {
        await logApiCall(matchId, result.match.apiCallLog, "GET",
          `/sandbox/${matchId}/documents/${docId}?page=${pageParam}`, 400, startTime);
        return errorEnvelope(
          c,
          `Invalid page number. Document has ${doc.pages.length} pages (1-${doc.pages.length}).`,
          400,
          "Page not found in the depths.",
        );
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/documents/${docId}?page=${pageNum}`, 200, startTime);

      return c.json({
        doc_id: doc.id,
        title: doc.title,
        author: doc.author,
        page: pageNum,
        total_pages: doc.pages.length,
        content: doc.pages[pageNum - 1],
      });
    });

    // GET /:matchId/search — keyword search across all documents
    sandbox.get("/:matchId/search", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const query = c.req.query("q");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The archive is sealed.");
      }

      if (!query || query.trim().length === 0) {
        await logApiCall(matchId, result.match.apiCallLog, "GET",
          `/sandbox/${matchId}/search`, 400, startTime);
        return errorEnvelope(c, "Query parameter 'q' is required", 400, "You must speak to search the archive.");
      }

      const normalizedQuery = query.toLowerCase().trim();
      const results: Array<{ doc_id: string; page: number; excerpt: string }> = [];

      for (const doc of result.data.documents) {
        for (let pageIdx = 0; pageIdx < doc.pages.length; pageIdx++) {
          const pageText = doc.pages[pageIdx].toLowerCase();
          if (pageText.includes(normalizedQuery)) {
            // Extract a snippet around the match
            const matchPos = pageText.indexOf(normalizedQuery);
            const snippetStart = Math.max(0, matchPos - 60);
            const snippetEnd = Math.min(doc.pages[pageIdx].length, matchPos + normalizedQuery.length + 60);
            const excerpt = (snippetStart > 0 ? "..." : "") +
              doc.pages[pageIdx].slice(snippetStart, snippetEnd) +
              (snippetEnd < doc.pages[pageIdx].length ? "..." : "");

            results.push({
              doc_id: doc.id,
              page: pageIdx + 1,
              excerpt,
            });

            // Cap at 10 results
            if (results.length >= 10) break;
          }
        }
        if (results.length >= 10) break;
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/search?q=${encodeURIComponent(query)}`, 200, startTime);

      return c.json({
        query,
        results,
        total: results.length,
      });
    });

    // GET /:matchId/questions — returns the 5 synthesis questions
    sandbox.get("/:matchId/questions", async (c) => {
      const startTime = Date.now();
      const matchId = c.req.param("matchId");
      const result = await getMatchAndData(matchId);

      if (!result) {
        return errorEnvelope(c, "Match not found or expired", 404, "The archive is sealed.");
      }

      await logApiCall(matchId, result.match.apiCallLog, "GET",
        `/sandbox/${matchId}/questions`, 200, startTime);

      return c.json({
        questions: result.data.questions,
        total: result.data.questions.length,
      });
    });

    return sandbox;
  },
};
