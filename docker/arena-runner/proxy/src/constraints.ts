/**
 * Pure constraint enforcement functions for the arena-runner proxy.
 * All functions are stateless — easily unit-testable.
 */

export interface ProxyConstraints {
  tokenBudget?: number;
  maxLlmCalls?: number;
  allowedModels?: string[];
  networkAccess?: boolean; // default: true
}

/**
 * Parse PROXY_CONSTRAINTS env var JSON into ProxyConstraints.
 * Returns null if the env var is absent or malformed.
 */
export function parseConstraints(raw: string | undefined): ProxyConstraints | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as ProxyConstraints;
  } catch {
    return null;
  }
}

/**
 * Returns true if the call limit has been reached or exceeded.
 * (i.e. the *next* call should be blocked)
 */
export function checkCallLimit(count: number, max: number): boolean {
  return count >= max;
}

/**
 * Returns true if the cumulative token budget has been exceeded.
 */
export function checkTokenBudget(used: number, budget: number): boolean {
  return used > budget;
}

/**
 * Returns true if the model is allowed by the allowedModels list.
 * Matching is case-insensitive substring: "claude-sonnet" matches "claude-sonnet-4-6".
 */
export function checkModelAllowed(model: string, allowed: string[]): boolean {
  if (allowed.length === 0) return false;
  const lower = model.toLowerCase();
  return allowed.some((a) => lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower));
}
