import { describe, it, expect } from "vitest";
import {
  computeQuorum,
  REVIEWER_MIN_VERIFIED_MATCHES,
  REVIEWER_DEFAULT_TRUST_SCORE,
  QUORUM_MIN_REPORTS,
  QUORUM_MIN_TRUST_WEIGHT,
} from "../src/challenges/governance.js";
import type { ReviewerVerdict } from "@clawdiators/shared";

// ── Helpers ──────────────────────────────────────────────────────────

function makeVerdict(
  overrides: Partial<ReviewerVerdict> = {},
): ReviewerVerdict {
  return {
    agentId: "agent-" + Math.random().toString(36).slice(2),
    verdict: "accept",
    findings: [],
    severity: "info",
    trustScore: REVIEWER_DEFAULT_TRUST_SCORE,
    submittedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Constants ─────────────────────────────────────────────────────────

describe("Governance constants", () => {
  it("REVIEWER_MIN_VERIFIED_MATCHES is 5", () => {
    expect(REVIEWER_MIN_VERIFIED_MATCHES).toBe(5);
  });

  it("REVIEWER_DEFAULT_TRUST_SCORE is 0.5", () => {
    expect(REVIEWER_DEFAULT_TRUST_SCORE).toBe(0.5);
  });

  it("QUORUM_MIN_REPORTS is 2", () => {
    expect(QUORUM_MIN_REPORTS).toBe(2);
  });

  it("QUORUM_MIN_TRUST_WEIGHT is 1.0", () => {
    expect(QUORUM_MIN_TRUST_WEIGHT).toBe(1.0);
  });
});

// ── computeQuorum: pending states ────────────────────────────────────

describe("computeQuorum — pending", () => {
  it("returns pending with zero verdicts", () => {
    const result = computeQuorum([]);
    expect(result.status).toBe("pending");
    expect(result.reportCount).toBe(0);
    expect(result.trustWeightSum).toBe(0);
    expect(result.hasCriticalFinding).toBe(false);
  });

  it("returns pending with only 1 verdict (below min reports)", () => {
    const result = computeQuorum([makeVerdict()]);
    expect(result.status).toBe("pending");
    expect(result.reportCount).toBe(1);
  });

  it("returns pending when trust weight sum is below threshold", () => {
    // 2 reports each with trust 0.3 → sum 0.6 < 1.0
    const verdicts = [
      makeVerdict({ trustScore: 0.3 }),
      makeVerdict({ trustScore: 0.3 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("pending");
    expect(result.trustWeightSum).toBeCloseTo(0.6);
  });
});

// ── computeQuorum: accepted ───────────────────────────────────────────

describe("computeQuorum — accepted", () => {
  it("accepts on clear accept majority (2 accepts, 0 rejects)", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.7 }),
      makeVerdict({ verdict: "accept", trustScore: 0.5 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("accepted");
  });

  it("accepts on >60% accept weight with 3 reviewers", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.7 }),
      makeVerdict({ verdict: "accept", trustScore: 0.5 }),
      makeVerdict({ verdict: "reject", trustScore: 0.3 }),
    ];
    // accept: 1.2, reject: 0.3, total: 1.5 → accept/total = 0.8 > 0.6
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("accepted");
  });

  it("includes correct report count and trust weight in accepted result", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.6 }),
      makeVerdict({ verdict: "accept", trustScore: 0.5 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("accepted");
    expect(result.reportCount).toBe(2);
    expect(result.trustWeightSum).toBeCloseTo(1.1);
  });
});

// ── computeQuorum: rejected ───────────────────────────────────────────

describe("computeQuorum — rejected", () => {
  it("rejects on clear reject majority", () => {
    const verdicts = [
      makeVerdict({ verdict: "reject", trustScore: 0.7 }),
      makeVerdict({ verdict: "reject", trustScore: 0.5 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("rejected");
  });

  it("rejects when 'revise' votes count toward reject weight", () => {
    const verdicts = [
      makeVerdict({ verdict: "revise", trustScore: 0.7 }),
      makeVerdict({ verdict: "revise", trustScore: 0.5 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("rejected");
  });

  it("rejects on >60% reject weight (mixed reject+revise vs accept)", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.3 }),
      makeVerdict({ verdict: "reject", trustScore: 0.5 }),
      makeVerdict({ verdict: "revise", trustScore: 0.4 }),
    ];
    // accept: 0.3, reject: 0.9, total: 1.2 → reject/total = 0.75 > 0.6
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("rejected");
  });
});

// ── computeQuorum: escalated ──────────────────────────────────────────

describe("computeQuorum — escalated", () => {
  it("escalates on any critical finding (even with majority accept)", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.7, severity: "critical" }),
      makeVerdict({ verdict: "accept", trustScore: 0.5 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("escalated");
    expect(result.hasCriticalFinding).toBe(true);
  });

  it("escalates on close vote (no clear majority)", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.55 }),
      makeVerdict({ verdict: "reject", trustScore: 0.55 }),
    ];
    // accept: 0.55, reject: 0.55, total: 1.1 → neither side > 60%
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("escalated");
  });

  it("escalates on exactly 50/50 split", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.5 }),
      makeVerdict({ verdict: "reject", trustScore: 0.5 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("escalated");
  });

  it("hasCriticalFinding is false when only warn/info severity", () => {
    const verdicts = [
      makeVerdict({ severity: "warn", trustScore: 0.55 }),
      makeVerdict({ severity: "info", trustScore: 0.55 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.hasCriticalFinding).toBe(false);
  });
});

// ── computeQuorum: edge cases ─────────────────────────────────────────

describe("computeQuorum — edge cases", () => {
  it("returns pending even with high report count if trust weight too low", () => {
    // 5 reports but each has trust 0.1 → sum 0.5 < 1.0
    const verdicts = Array.from({ length: 5 }, () =>
      makeVerdict({ verdict: "accept", trustScore: 0.1 }),
    );
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("pending");
  });

  it("returns trustWeightSum accurately across many verdicts", () => {
    const verdicts = [
      makeVerdict({ trustScore: 0.3 }),
      makeVerdict({ trustScore: 0.4 }),
      makeVerdict({ trustScore: 0.6 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.trustWeightSum).toBeCloseTo(1.3);
  });

  it("accepts with exactly 2 reports when combined trust weight >= 1.0", () => {
    const verdicts = [
      makeVerdict({ verdict: "accept", trustScore: 0.7 }),
      makeVerdict({ verdict: "accept", trustScore: 0.5 }),
    ];
    // sum = 1.2 >= 1.0, 2 reports >= 2, 100% accept → accepted
    const result = computeQuorum(verdicts);
    expect(result.status).toBe("accepted");
  });

  it("reports reportCount correctly", () => {
    const verdicts = [
      makeVerdict({ trustScore: 0.5 }),
      makeVerdict({ trustScore: 0.5 }),
      makeVerdict({ trustScore: 0.5 }),
    ];
    const result = computeQuorum(verdicts);
    expect(result.reportCount).toBe(3);
  });
});
