import type { ParsedUsage } from "./providers.js";

export function isStreamingResponse(headers: Record<string, string | string[] | undefined>): boolean {
  const ct = headers["content-type"] ?? "";
  const ctStr = Array.isArray(ct) ? ct.join(", ") : ct;
  return ctStr.includes("text/event-stream");
}

export function accumulateSSE(chunks: Buffer[]): string {
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw;
}

/**
 * Extract usage from an Anthropic SSE stream.
 * Looks for message_start (input tokens) and message_delta (output tokens).
 */
function extractAnthropicSSE(sseData: string): ParsedUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let model = "unknown";

  const lines = sseData.split("\n");
  let pendingEvent = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      pendingEvent = line.slice("event: ".length).trim();
    } else if (line.startsWith("data: ")) {
      const dataStr = line.slice("data: ".length).trim();
      if (dataStr === "[DONE]") continue;
      try {
        const data = JSON.parse(dataStr);
        if (pendingEvent === "message_start" && data.type === "message_start") {
          inputTokens = data?.message?.usage?.input_tokens ?? 0;
          model = data?.message?.model ?? model;
        } else if (pendingEvent === "message_delta" && data.type === "message_delta") {
          outputTokens = data?.usage?.output_tokens ?? 0;
        }
      } catch {
        // skip malformed
      }
    }
  }

  if (inputTokens === 0 && outputTokens === 0) {
    return { model, input_tokens: 0, output_tokens: 0, extraction: "unknown" };
  }

  return { model, input_tokens: inputTokens, output_tokens: outputTokens, extraction: "exact" };
}

/**
 * Extract usage from an OpenAI SSE stream.
 * Looks for the final chunk with non-null usage (requires stream_options.include_usage: true).
 */
function extractOpenAISSE(sseData: string): ParsedUsage {
  let model = "unknown";
  let lastUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;

  const lines = sseData.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const dataStr = line.slice("data: ".length).trim();
      if (dataStr === "[DONE]") continue;
      try {
        const data = JSON.parse(dataStr);
        if (data.model) model = data.model;
        if (data.usage && data.usage.prompt_tokens != null) {
          lastUsage = data.usage;
        }
      } catch {
        // skip
      }
    }
  }

  if (lastUsage) {
    return {
      model,
      input_tokens: lastUsage.prompt_tokens ?? 0,
      output_tokens: lastUsage.completion_tokens ?? 0,
      extraction: "exact",
    };
  }

  return { model, input_tokens: 0, output_tokens: 0, extraction: "unknown" };
}

// ── Tool use extraction ───────────────────────────────────────────────

function extractAnthropicToolNames(sseData: string): string[] {
  const names: string[] = [];
  for (const line of sseData.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const dataStr = line.slice("data: ".length).trim();
    if (dataStr === "[DONE]") continue;
    try {
      const data = JSON.parse(dataStr);
      if (data.type === "content_block_start" && data.content_block?.type === "tool_use") {
        names.push(data.content_block.name as string);
      }
    } catch { /* skip malformed */ }
  }
  return names;
}

function extractOpenAIToolNames(sseData: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const line of sseData.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const dataStr = line.slice("data: ".length).trim();
    if (dataStr === "[DONE]") continue;
    try {
      const data = JSON.parse(dataStr);
      const toolCalls = data.choices?.[0]?.delta?.tool_calls;
      if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
          const name = tc.function?.name as string | undefined;
          if (name && !seen.has(name)) {
            seen.add(name);
            names.push(name);
          }
        }
      }
    } catch { /* skip malformed */ }
  }
  return names;
}

/**
 * Extract tool names used from a streaming response body.
 * Returns deduplicated list of tool names called in this response.
 */
export function extractStreamingToolNames(provider: string, sseData: string): string[] {
  try {
    switch (provider) {
      case "anthropic": return extractAnthropicToolNames(sseData);
      case "openai":    return extractOpenAIToolNames(sseData);
      default:          return [];
    }
  } catch {
    return [];
  }
}

/**
 * Extract tool names from a non-streaming response body.
 */
export function extractNonStreamingToolNames(provider: string, body: string): string[] {
  try {
    const json = JSON.parse(body);
    switch (provider) {
      case "anthropic": {
        const content = json?.content as Array<{ type: string; name?: string }> | undefined;
        if (!Array.isArray(content)) return [];
        return content.filter((b) => b.type === "tool_use" && b.name).map((b) => b.name!);
      }
      case "openai": {
        const toolCalls = json?.choices?.[0]?.message?.tool_calls as Array<{ function?: { name?: string } }> | undefined;
        if (!Array.isArray(toolCalls)) return [];
        return toolCalls.map((tc) => tc.function?.name ?? "").filter(Boolean);
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

export function extractStreamingUsage(provider: string, sseData: string): ParsedUsage {
  try {
    switch (provider) {
      case "anthropic": return extractAnthropicSSE(sseData);
      case "openai":    return extractOpenAISSE(sseData);
      default:          return { model: "unknown", input_tokens: 0, output_tokens: 0, extraction: "unknown" };
    }
  } catch {
    return { model: "unknown", input_tokens: 0, output_tokens: 0, extraction: "unknown" };
  }
}
