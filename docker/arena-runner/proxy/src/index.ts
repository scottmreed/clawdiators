/**
 * Arena Runner — Proxy-as-Endpoint
 *
 * Listens on port 8080 as a plain HTTP server that speaks LLM provider APIs.
 * The agent points its SDK base_url here; requests are forwarded to the real
 * upstream over HTTPS. Every LLM call is recorded in a tamper-evident hash chain.
 *
 * No TLS interception. No CA cert. No HTTPS_PROXY.
 *
 * Agent setup (2 env vars, any language):
 *   ANTHROPIC_BASE_URL=http://localhost:8080
 *   OPENAI_BASE_URL=http://localhost:8080          (also works for OpenAI-compat APIs)
 *   GOOGLE_GENERATIVE_AI_API_BASE_URL=http://localhost:8080
 *
 * For providers that share a path prefix (e.g. OpenRouter vs OpenAI both use
 * /v1/chat/completions), add an X-Upstream-Host header to route explicitly:
 *   X-Upstream-Host: openrouter.ai
 */

import * as http from "node:http";
import * as https from "node:https";
import * as fs from "node:fs";
import * as path from "node:path";
import { computeChainHash, hashBody } from "./chain.js";
import { detectProvider, parseResponseBody, parseRequestBody } from "./providers.js";
import { isStreamingResponse, accumulateSSE, extractStreamingUsage, extractStreamingToolNames, extractNonStreamingToolNames } from "./streaming.js";
import { parseConstraints, checkCallLimit, checkTokenBudget, checkModelAllowed } from "./constraints.js";
import { computeCost, loadPricingFromAPI } from "./pricing.js";
import type { LLMCallRecord, VerifiedAttestation, ConstraintViolation, HarnessSnapshot } from "./types.js";

// ── Configuration ──────────────────────────────────────────────────────

const PORT = parseInt(process.env.PROXY_PORT ?? "8080", 10);
const NONCE = process.env.PROXY_NONCE;
const IMAGE_DIGEST = process.env.IMAGE_DIGEST ?? "sha256:unknown";
const ATTESTATION_DIR = process.env.ATTESTATION_DIR ?? "/attestation";

if (!NONCE) {
  console.error("PROXY_NONCE environment variable is required");
  process.exit(1);
}

// ── Constraints ────────────────────────────────────────────────────────

const constraints = parseConstraints(process.env.PROXY_CONSTRAINTS);

// ── State ──────────────────────────────────────────────────────────────

const state = {
  nonce: NONCE,
  calls: [] as LLMCallRecord[],
  violations: [] as ConstraintViolation[],
  seq: 0,
  prevHash: NONCE,
  cumulativeTokens: 0,
  startedAt: new Date(),
  harnessSnapshot: {
    system_prompt_hash: null as string | null,
    tool_definitions_hash: null as string | null,
    tools_observed: [] as string[],
    models_used: [] as string[],
    firstRequestSeen: false,
  },
  totalToolCalls: 0,
};

fs.mkdirSync(ATTESTATION_DIR, { recursive: true });

// Clean stale files from prior runs — prevents immediate finalization
// if a previous container left a "done" sentinel in the same volume mount
for (const stale of ["done", "attestation.json", "calls.jsonl"]) {
  const p = path.join(ATTESTATION_DIR, stale);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`[proxy] Cleaned stale file: ${p}`);
  }
}

// ── Provider Routing ───────────────────────────────────────────────────

interface ProviderRoute {
  upstream: string;
  provider: string;
}

/**
 * Map path prefixes to upstream hosts. Order matters — first match wins.
 * Agents can override by setting X-Upstream-Host on any request.
 */
const PATH_ROUTES: Array<{ prefix: string; upstream: string; provider: string }> = [
  { prefix: "/v1/messages",         upstream: "api.anthropic.com",                 provider: "anthropic"  },
  { prefix: "/v1/chat/completions", upstream: "api.openai.com",                    provider: "openai"     },
  { prefix: "/v1/completions",      upstream: "api.openai.com",                    provider: "openai"     },
  { prefix: "/v1beta/models",       upstream: "generativelanguage.googleapis.com", provider: "google"     },
  { prefix: "/v1/embeddings",       upstream: "api.openai.com",                    provider: "openai"     },
];

function detectRoute(reqPath: string, overrideHost?: string): ProviderRoute | null {
  // Explicit upstream override via X-Upstream-Host header — supports OpenRouter, Together, etc.
  if (overrideHost) {
    return { upstream: overrideHost, provider: detectProvider(overrideHost) };
  }
  for (const route of PATH_ROUTES) {
    if (reqPath.startsWith(route.prefix)) {
      return { upstream: route.upstream, provider: route.provider };
    }
  }
  return null;
}

// ── Call Recording ─────────────────────────────────────────────────────

function recordCall(record: LLMCallRecord): void {
  state.prevHash = computeChainHash(state.prevHash, record.seq, record);
  state.calls.push(record);

  const callsPath = path.join(ATTESTATION_DIR, "calls.jsonl");
  fs.appendFileSync(callsPath, JSON.stringify(record) + "\n");
}

// ── Attestation Finalization ───────────────────────────────────────────

function finalizeAttestation(): void {
  const wallClockSecs = Math.round((Date.now() - state.startedAt.getTime()) / 1000);

  const { firstRequestSeen: _, ...harnessSnapshotData } = state.harnessSnapshot;
  const harness_snapshot: HarnessSnapshot = harnessSnapshotData;

  const estimated_cost = computeCost(state.calls);

  const attestation: VerifiedAttestation = {
    image_digest: IMAGE_DIGEST,
    nonce: state.nonce,
    chain_head_hash: state.prevHash,
    chain_length: state.calls.length,
    llm_calls: state.calls,
    total_input_tokens: state.calls.reduce((s, c) => s + c.input_tokens, 0),
    total_output_tokens: state.calls.reduce((s, c) => s + c.output_tokens, 0),
    total_llm_calls: state.calls.length,
    total_tool_calls: state.totalToolCalls,
    wall_clock_secs: wallClockSecs,
    harness_snapshot,
    estimated_cost,
    activity_summary: {
      unique_tools: [...new Set(state.harnessSnapshot.tools_observed)],
      files_read: 0,
      files_written: 0,
      commands_run: 0,
    },
    constraint_violations: state.violations,
  };

  fs.writeFileSync(
    path.join(ATTESTATION_DIR, "attestation.json"),
    JSON.stringify(attestation, null, 2),
  );

  console.log(`[proxy] Attestation finalized: ${state.calls.length} LLM calls`);
}

// ── Request Body Collection ────────────────────────────────────────────

function collectBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

// ── HTTP Server ────────────────────────────────────────────────────────

// Headers that must not be forwarded to the upstream
const HOP_BY_HOP = new Set([
  "host", "connection", "keep-alive", "proxy-connection",
  "te", "trailers", "transfer-encoding", "upgrade",
  "x-upstream-host", // our own routing header — strip before forwarding
]);

const server = http.createServer(async (req, res) => {
  const reqPath = req.url ?? "/";

  // ── Health check — used by VerifiedRunner to confirm proxy is ready ──
  if (req.method === "GET" && (reqPath === "/health" || reqPath === "/health/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, calls: state.seq }));
    return;
  }

  // ── Provider routing ──────────────────────────────────────────────────
  const overrideHost = req.headers["x-upstream-host"] as string | undefined;
  const route = detectRoute(reqPath, overrideHost);

  if (!route) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Unknown provider path",
      hint: "Set ANTHROPIC_BASE_URL=http://localhost:8080, OPENAI_BASE_URL=http://localhost:8080, or use X-Upstream-Host header for other providers.",
      supported_paths: PATH_ROUTES.map((r) => r.prefix),
    }));
    return;
  }

  // ── Constraint enforcement (pre-call) ────────────────────────────────
  if (constraints?.maxLlmCalls !== undefined && checkCallLimit(state.seq, constraints.maxLlmCalls)) {
    const violation: ConstraintViolation = {
      type: "call_limit",
      detail: `call_limit exceeded: ${state.seq} >= ${constraints.maxLlmCalls}`,
      seq: state.seq,
      ts: new Date().toISOString(),
    };
    state.violations.push(violation);
    console.log(`[proxy] Call limit exceeded: ${state.seq}/${constraints.maxLlmCalls}`);
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "LLM call limit exceeded" }));
    return;
  }

  if (constraints?.tokenBudget !== undefined && checkTokenBudget(state.cumulativeTokens, constraints.tokenBudget)) {
    const violation: ConstraintViolation = {
      type: "token_budget",
      detail: `token_budget exceeded: ${state.cumulativeTokens} > ${constraints.tokenBudget}`,
      seq: state.seq,
      ts: new Date().toISOString(),
    };
    state.violations.push(violation);
    console.log(`[proxy] Token budget exceeded: ${state.cumulativeTokens}/${constraints.tokenBudget}`);
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Token budget exceeded" }));
    return;
  }

  // ── Collect and hash request body ────────────────────────────────────
  const requestBody = await collectBody(req).catch((err: Error) => {
    console.error(`[proxy] Error reading request body: ${err.message}`);
    return "";
  });
  const requestHash = hashBody(requestBody);
  const requestStartMs = Date.now();

  // ── Harness fingerprinting — from first request ───────────────────────
  if (!state.harnessSnapshot.firstRequestSeen && requestBody) {
    state.harnessSnapshot.firstRequestSeen = true;
    const parsedReq = parseRequestBody(route.provider, requestBody);
    if (parsedReq.system_prompt) {
      state.harnessSnapshot.system_prompt_hash = hashBody(parsedReq.system_prompt);
    }
    if (parsedReq.tools) {
      state.harnessSnapshot.tool_definitions_hash = hashBody(JSON.stringify(parsedReq.tools));
    }
  }

  // ── Build upstream headers — pass through, skip hop-by-hop ───────────
  const upstreamHeaders: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && val !== undefined) {
      upstreamHeaders[key] = val as string | string[];
    }
  }

  // ── Forward to real upstream ──────────────────────────────────────────
  const upstreamReq = https.request(
    {
      hostname: route.upstream,
      port: 443,
      path: reqPath,
      method: req.method ?? "POST",
      headers: upstreamHeaders,
    },
    (upstreamRes) => {
      const resChunks: Buffer[] = [];
      const resHeaders = upstreamRes.headers as Record<string, string | string[] | undefined>;
      const streaming = isStreamingResponse(resHeaders);

      // Forward status + headers to agent
      const forwardHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        if (v !== undefined) forwardHeaders[k] = v;
      }
      res.writeHead(upstreamRes.statusCode ?? 200, forwardHeaders);

      // Stream chunks to agent while accumulating for recording
      upstreamRes.on("data", (chunk: Buffer) => {
        resChunks.push(chunk);
        res.write(chunk);
      });

      upstreamRes.on("end", () => {
        res.end();

        const durationMs = Date.now() - requestStartMs;
        const responseBody = streaming
          ? accumulateSSE(resChunks)
          : Buffer.concat(resChunks).toString("utf-8");
        const responseHash = hashBody(responseBody);

        const parsed = streaming
          ? extractStreamingUsage(route.provider, responseBody)
          : parseResponseBody(route.provider, responseBody);

        state.seq += 1;
        const record: LLMCallRecord = {
          seq: state.seq,
          ts: new Date().toISOString(),
          provider: route.provider,
          model: parsed.model,
          input_tokens: parsed.input_tokens,
          output_tokens: parsed.output_tokens,
          duration_ms: durationMs,
          status_code: upstreamRes.statusCode ?? 0,
          request_hash: requestHash,
          response_hash: responseHash,
          token_extraction: parsed.extraction,
        };

        recordCall(record);

        // Track tools used and model names
        const toolNames = streaming
          ? extractStreamingToolNames(route.provider, responseBody)
          : extractNonStreamingToolNames(route.provider, responseBody);
        state.totalToolCalls += toolNames.length;
        for (const name of toolNames) {
          if (!state.harnessSnapshot.tools_observed.includes(name)) {
            state.harnessSnapshot.tools_observed.push(name);
          }
        }
        if (record.model !== "unknown" && !state.harnessSnapshot.models_used.includes(record.model)) {
          state.harnessSnapshot.models_used.push(record.model);
        }

        console.log(
          `[proxy] ${route.provider} call #${record.seq}: ${record.input_tokens}in/${record.output_tokens}out (${record.token_extraction})` +
          (toolNames.length > 0 ? ` [${toolNames.length} tool call(s)]` : ""),
        );

        // Post-call constraint checks (advisory — will block next call)
        state.cumulativeTokens += record.input_tokens + record.output_tokens;

        if (constraints?.allowedModels !== undefined && !checkModelAllowed(record.model, constraints.allowedModels)) {
          const v: ConstraintViolation = {
            type: "model_violation",
            detail: `model_violation: ${record.model} not in [${constraints.allowedModels.join(", ")}]`,
            seq: record.seq,
            ts: new Date().toISOString(),
          };
          state.violations.push(v);
          console.log(`[proxy] Model violation: ${record.model}`);
        }

        if (constraints?.tokenBudget !== undefined && checkTokenBudget(state.cumulativeTokens, constraints.tokenBudget)) {
          console.log(`[proxy] Token budget will block next call: ${state.cumulativeTokens}/${constraints.tokenBudget}`);
        }
      });

      upstreamRes.on("error", (err) => {
        console.error(`[proxy] Upstream response error: ${err.message}`);
        res.end();
      });
    },
  );

  upstreamReq.on("error", (err) => {
    console.error(`[proxy] Upstream request error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "Bad Gateway", detail: err.message }));
  });

  if (requestBody) {
    upstreamReq.write(requestBody);
  }
  upstreamReq.end();
});

// ── Startup ────────────────────────────────────────────────────────────

const CLAWDIATORS_API_URL = process.env.CLAWDIATORS_API_URL;
const MATCH_ID = process.env.PROXY_MATCH_ID;
const PROXY_START_TOKEN_VALUE = process.env.PROXY_START_TOKEN;

const startup = CLAWDIATORS_API_URL
  ? loadPricingFromAPI(CLAWDIATORS_API_URL)
  : Promise.resolve();

startup.finally(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[proxy] Listening on port ${PORT}`);
    console.log(`[proxy] Nonce: ${NONCE}`);
    console.log(`[proxy] Attestation dir: ${ATTESTATION_DIR}`);

    // Fire-and-forget proxy-ready registration to unlock the workspace
    if (MATCH_ID && PROXY_START_TOKEN_VALUE && CLAWDIATORS_API_URL) {
      void fetch(`${CLAWDIATORS_API_URL}/api/v1/matches/${MATCH_ID}/proxy-ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce: NONCE, proxy_start_token: PROXY_START_TOKEN_VALUE }),
      }).then(async (res) => {
        if (res.ok) {
          console.log(`[proxy] Registered with Clawdiators API for match ${MATCH_ID}`);
        } else {
          console.error(`[proxy] Failed to register: ${res.status} ${await res.text().catch(() => "")}`);
        }
      }).catch((err) => console.error(`[proxy] Registration error:`, err));
    }
  });
});

// ── Sentinel Watcher ───────────────────────────────────────────────────

const SENTINEL_PATH = path.join(ATTESTATION_DIR, "done");

const watchInterval = setInterval(() => {
  if (fs.existsSync(SENTINEL_PATH)) {
    clearInterval(watchInterval);
    console.log("[proxy] Sentinel detected. Finalizing attestation...");
    finalizeAttestation();
    server.close(() => {
      process.exit(0);
    });
  }
}, 500);

process.on("SIGTERM", () => {
  clearInterval(watchInterval);
  finalizeAttestation();
  server.close(() => process.exit(0));
});
