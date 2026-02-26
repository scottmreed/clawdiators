import { describe, it, expect } from "vitest";
import { generateCascadingData } from "../src/challenges/cascading-failure/data.js";
import { scoreCascading } from "../src/challenges/cascading-failure/scorer.js";
import { generateGauntletData } from "../src/challenges/toolchain-gauntlet/data.js";
import { scoreGauntlet } from "../src/challenges/toolchain-gauntlet/scorer.js";
import { generateLedgerData } from "../src/challenges/tide-ledger/data.js";
import { scoreLedger } from "../src/challenges/tide-ledger/scorer.js";
import { generateMappingData } from "../src/challenges/deep-mapping/data.js";
import { scoreMapping } from "../src/challenges/deep-mapping/scorer.js";
import { generateCipherData } from "../src/challenges/cipher-forge/data.js";
import { scoreCipher } from "../src/challenges/cipher-forge/scorer.js";
import { generateLogicData } from "../src/challenges/logic-reef/data.js";
import { scoreLogic } from "../src/challenges/logic-reef/scorer.js";
import { generateRefactorData } from "../src/challenges/reef-refactor/data.js";
import { scoreRefactor } from "../src/challenges/reef-refactor/scorer.js";
import { generateSwitchboardData } from "../src/challenges/switchboard/data.js";
import { scoreSwitchboard } from "../src/challenges/switchboard/scorer.js";
import { generateReconData } from "../src/challenges/rate-limited-recon/data.js";
import { scoreRecon } from "../src/challenges/rate-limited-recon/scorer.js";
import { generateDepthFirstData } from "../src/challenges/depth-first-gen/data.js";
import { scoreDepthFirst } from "../src/challenges/depth-first-gen/scorer.js";
import { generateArchiveData } from "../src/challenges/archive-dive/data.js";
import { scoreArchive } from "../src/challenges/archive-dive/scorer.js";
import { generateContractData } from "../src/challenges/contract-review/data.js";
import { scoreContract } from "../src/challenges/contract-review/scorer.js";
import { generateCensusData } from "../src/challenges/coral-census/data.js";
import { scoreCensus } from "../src/challenges/coral-census/scorer.js";
import { generateSupplyChainData } from "../src/challenges/supply-chain/data.js";
import { scoreSupplyChain } from "../src/challenges/supply-chain/scorer.js";
import { generateForensicsData } from "../src/challenges/chart-forensics/data.js";
import { scoreForensics } from "../src/challenges/chart-forensics/scorer.js";
import { generateCartographerData } from "../src/challenges/cartographers-eye/data.js";
import { scoreCartographer } from "../src/challenges/cartographers-eye/scorer.js";
import { generateBlueprintData } from "../src/challenges/blueprint-audit/data.js";
import { scoreBlueprint } from "../src/challenges/blueprint-audit/scorer.js";
import { generateInterviewData } from "../src/challenges/adversarial-interview/data.js";
import { scoreInterview } from "../src/challenges/adversarial-interview/scorer.js";
import { generateMirageData } from "../src/challenges/the-mirage/data.js";
import { scoreMirage } from "../src/challenges/the-mirage/scorer.js";

// ── Cascading Failure ────────────────────────────────────────────────

describe("Cascading Failure data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateCascadingData(42);
    const d2 = generateCascadingData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.weather).toEqual(d2.weather);
    expect(d1.objective).toEqual(d2.objective);
  });

  it("different seeds produce different data", () => {
    const d1 = generateCascadingData(42);
    const d2 = generateCascadingData(99);
    expect(d1.groundTruth.target_ticker).not.toBe(d2.groundTruth.target_ticker);
  });

  it("has a failure schedule", () => {
    const d = generateCascadingData(42);
    expect(d.groundTruth.failure_schedule.length).toBeGreaterThan(0);
    for (const f of d.groundTruth.failure_schedule) {
      expect(f.callNumber).toBeGreaterThan(0);
      expect(["500", "malformed", "404", "stale", "timeout"]).toContain(f.type);
    }
  });
});

describe("Cascading Failure scoring", () => {
  const data = generateCascadingData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("is deterministic", () => {
    const sub = { ticker: gt.target_ticker };
    const r1 = scoreCascading({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 10 });
    const r2 = scoreCascading({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 10 });
    expect(r1).toEqual(r2);
  });

  it("scores resilience higher for agents that report errors", () => {
    const withErrors = scoreCascading({
      submission: { ticker: gt.target_ticker, error_log: ["500 on weather"] },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 15,
    });
    const withoutErrors = scoreCascading({
      submission: { ticker: gt.target_ticker },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 15,
    });
    expect(withErrors.breakdown.resilience).toBeGreaterThan(withoutErrors.breakdown.resilience);
  });

  it("score never exceeds 1000", () => {
    const r = scoreCascading({
      submission: { ticker: gt.target_ticker, close_price: gt.target_close_price, headline: gt.target_article_headline, sentiment: gt.target_sentiment, price_change_pct: gt.price_change_pct, error_log: ["handled"] },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 3,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Tool-Chain Gauntlet ──────────────────────────────────────────────

describe("Tool-Chain Gauntlet data generation", () => {
  it("is deterministic", () => {
    const d1 = generateGauntletData(42);
    const d2 = generateGauntletData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.registry).toEqual(d2.registry);
  });

  it("different seeds produce different data", () => {
    const d1 = generateGauntletData(42);
    const d2 = generateGauntletData(999);
    expect(d1.groundTruth.optimalProduct.sku).not.toBe(d2.groundTruth.optimalProduct.sku);
  });

  it("generates all 6 API datasets", () => {
    const d = generateGauntletData(42);
    expect(d.registry.length).toBeGreaterThan(0);
    expect(d.inventory.length).toBeGreaterThan(0);
    expect(d.pricing.length).toBeGreaterThan(0);
    expect(d.shipping.length).toBeGreaterThan(0);
    expect(d.loyalty.customerId).toBeDefined();
    expect(d.audit.length).toBeGreaterThan(0);
  });

  it("optimal product is in stock, compliant, and cheapest", () => {
    const d = generateGauntletData(42);
    const opt = d.groundTruth.optimalProduct;
    // In stock
    const inStock = d.inventory.find((i) => i.sku === opt.sku && i.warehouse === opt.warehouse);
    expect(inStock).toBeDefined();
    expect(inStock!.quantity).toBeGreaterThan(0);
    // Compliant
    const audit = d.audit.find((a) => a.sku === opt.sku);
    expect(audit?.compliant).toBe(true);
  });
});

describe("Tool-Chain Gauntlet scoring", () => {
  const data = generateGauntletData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("is deterministic", () => {
    const sub = { sku: gt.optimalProduct.sku };
    const r1 = scoreGauntlet({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 6 });
    const r2 = scoreGauntlet({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 6 });
    expect(r1).toEqual(r2);
  });

  it("perfect answer with checkpoints gets high score", () => {
    const r = scoreGauntlet({
      submission: {
        sku: gt.optimalProduct.sku,
        final_price: gt.optimalProduct.finalPrice,
        shipping_cost: gt.optimalProduct.shippingCost,
        total_cost: gt.optimalProduct.totalCost,
        carrier: gt.optimalProduct.carrier,
        delivery_days: gt.optimalProduct.deliveryDays,
      },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 6,
      checkpoints: [{}, {}, {}],
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });
});

// ── Tide Ledger ──────────────────────────────────────────────────────

describe("Tide Ledger data generation", () => {
  it("is deterministic", () => {
    const d1 = generateLedgerData(42);
    const d2 = generateLedgerData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.phase1_transactions).toEqual(d2.phase1_transactions);
  });

  it("different seeds produce different data", () => {
    const d1 = generateLedgerData(42);
    const d2 = generateLedgerData(999);
    expect(d1.groundTruth.phase3_final_total).not.toBe(d2.groundTruth.phase3_final_total);
  });

  it("generates correct phase sizes", () => {
    const d = generateLedgerData(42);
    expect(d.phase1_transactions).toHaveLength(50);
    expect(d.phase2_amendments).toHaveLength(30);
    expect(d.phase3_rollbacks).toHaveLength(20);
    expect(d.phase3_new_transactions).toHaveLength(10);
  });

  it("phase1 balances are internally consistent", () => {
    const d = generateLedgerData(42);
    const computed: Record<string, number> = {};
    for (const txn of d.phase1_transactions) {
      if (!computed[txn.account]) computed[txn.account] = 0;
      if (txn.type === "credit") computed[txn.account] = Math.round((computed[txn.account] + txn.amount) * 100) / 100;
      else computed[txn.account] = Math.round((computed[txn.account] - txn.amount) * 100) / 100;
    }
    expect(computed).toEqual(d.groundTruth.phase1_balances);
  });
});

describe("Tide Ledger scoring", () => {
  const data = generateLedgerData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("is deterministic", () => {
    const sub = { balances: gt.phase3_balances, total: gt.phase3_final_total };
    const r1 = scoreLedger({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 6 });
    const r2 = scoreLedger({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 6 });
    expect(r1).toEqual(r2);
  });

  it("perfect answer with checkpoints gets high score", () => {
    const r = scoreLedger({
      submission: { balances: gt.phase3_balances, total: gt.phase3_final_total },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 6,
      checkpoints: [
        { data: { balances: gt.phase1_balances } },
        { data: { balances: gt.phase2_balances } },
        { data: { balances: gt.phase3_balances } },
      ],
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });
});

// ── Deep Mapping ─────────────────────────────────────────────────────

describe("Deep Mapping data generation", () => {
  it("is deterministic", () => {
    const d1 = generateMappingData(42);
    const d2 = generateMappingData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.nodes).toEqual(d2.nodes);
  });

  it("different seeds produce different data", () => {
    const d1 = generateMappingData(42);
    const d2 = generateMappingData(999);
    expect(d1.groundTruth.deepestNode.id).not.toBe(d2.groundTruth.deepestNode.id);
  });

  it("generates 30-40 nodes", () => {
    const d = generateMappingData(42);
    expect(d.nodes.length).toBeGreaterThanOrEqual(30);
    expect(d.nodes.length).toBeLessThanOrEqual(40);
  });

  it("graph is connected (all nodes reachable from start)", () => {
    const d = generateMappingData(42);
    const visited = new Set<string>();
    const queue = [d.startNodeId];
    visited.add(d.startNodeId);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = d.nodes.find((n) => n.id === current);
      if (!node) continue;
      for (const conn of node.connections) {
        if (!visited.has(conn)) {
          visited.add(conn);
          queue.push(conn);
        }
      }
    }
    expect(visited.size).toBe(d.nodes.length);
  });
});

describe("Deep Mapping scoring", () => {
  const data = generateMappingData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("is deterministic", () => {
    const sub = { nodes_discovered: 20 };
    const r1 = scoreMapping({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 600000), apiCallCount: 20 });
    const r2 = scoreMapping({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 600000), apiCallCount: 20 });
    expect(r1).toEqual(r2);
  });

  it("full coverage gets high coverage score", () => {
    const r = scoreMapping({
      submission: {
        nodes_discovered: gt.totalNodes,
        deepest_node: gt.deepestNode.id,
        most_connected_node: gt.mostConnectedNode.id,
        resources_by_type: gt.resourcesByType,
        total_resource_value: gt.totalResourceValue,
        best_path: gt.optimalPath,
        path_value: gt.optimalPathValue,
      },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 600000),
      apiCallCount: gt.totalNodes,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(600);
  });

  it("score never exceeds 1000", () => {
    const r = scoreMapping({
      submission: {
        nodes_discovered: gt.totalNodes,
        deepest_node: gt.deepestNode.id,
        most_connected_node: gt.mostConnectedNode.id,
        resources_by_type: gt.resourcesByType,
        total_resource_value: gt.totalResourceValue,
        best_path: gt.optimalPath,
        path_value: gt.optimalPathValue,
      },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000),
      apiCallCount: gt.totalNodes,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Cipher Forge ────────────────────────────────────────────────────

describe("Cipher Forge data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateCipherData(42);
    const d2 = generateCipherData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.messages).toEqual(d2.messages);
  });

  it("different seeds produce different data", () => {
    const d1 = generateCipherData(42);
    const d2 = generateCipherData(99);
    expect(d1.groundTruth.messages[0].plaintext).not.toBe(d2.groundTruth.messages[0].plaintext);
  });

  it("generates 5 messages with progressive difficulty", () => {
    const d = generateCipherData(42);
    expect(d.messages).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(d.messages[i].difficulty).toBe(i + 1);
    }
  });

  it("generates different cipher types", () => {
    const d = generateCipherData(42);
    const types = d.messages.map((m) => m.cipher_type);
    expect(types).toContain("caesar");
    expect(types).toContain("substitution");
    expect(types).toContain("vigenere");
    expect(types).toContain("transposition");
    expect(types).toContain("combined");
  });

  it("provides a reference table", () => {
    const d = generateCipherData(42);
    expect(d.reference_table.most_common).toBeDefined();
  });
});

describe("Cipher Forge scoring", () => {
  const data = generateCipherData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("is deterministic", () => {
    const sub: Record<string, unknown> = {};
    sub[gt.messages[0].id] = gt.messages[0].plaintext;
    const r1 = scoreCipher({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 2 });
    const r2 = scoreCipher({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 2 });
    expect(r1).toEqual(r2);
  });

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const msg of gt.messages) {
      sub[msg.id] = msg.plaintext;
    }
    const r = scoreCipher({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const msg of gt.messages) {
      sub[msg.id] = msg.plaintext;
    }
    const r = scoreCipher({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Logic Reef ──────────────────────────────────────────────────────

describe("Logic Reef data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateLogicData(42);
    const d2 = generateLogicData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.puzzles).toEqual(d2.puzzles);
  });

  it("different seeds produce different data", () => {
    const d1 = generateLogicData(42);
    const d2 = generateLogicData(99);
    expect(d1.puzzles[0].premises).not.toEqual(d2.puzzles[0].premises);
  });

  it("generates 6 puzzles (3 propositional + 3 constraint)", () => {
    const d = generateLogicData(42);
    expect(d.puzzles).toHaveLength(6);
    const propCount = d.puzzles.filter((p) => p.type === "propositional").length;
    const cspCount = d.puzzles.filter((p) => p.type === "constraint").length;
    expect(propCount).toBe(3);
    expect(cspCount).toBe(3);
  });

  it("each puzzle has premises, rules, and a question", () => {
    const d = generateLogicData(42);
    for (const p of d.puzzles) {
      expect(p.premises.length).toBeGreaterThan(0);
      expect(p.rules.length).toBeGreaterThan(0);
      expect(p.question.length).toBeGreaterThan(0);
    }
  });
});

describe("Logic Reef scoring", () => {
  const data = generateLogicData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("is deterministic", () => {
    const sub: Record<string, unknown> = {};
    sub[gt.puzzles[0].id] = gt.puzzles[0].answer;
    const r1 = scoreLogic({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1 });
    const r2 = scoreLogic({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1 });
    expect(r1).toEqual(r2);
  });

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const puzzle of gt.puzzles) {
      sub[puzzle.id] = puzzle.answer;
    }
    sub.reasoning = "By logical deduction.";
    const r = scoreLogic({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const puzzle of gt.puzzles) {
      sub[puzzle.id] = puzzle.answer;
    }
    sub.reasoning = "Short.";
    const r = scoreLogic({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Reef Refactor ───────────────────────────────────────────────────

describe("Reef Refactor data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateRefactorData(42);
    const d2 = generateRefactorData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.functions).toEqual(d2.functions);
  });

  it("different seeds produce different data", () => {
    const d1 = generateRefactorData(42);
    const d2 = generateRefactorData(99);
    const outputs1 = JSON.stringify(d1.groundTruth);
    const outputs2 = JSON.stringify(d2.groundTruth);
    expect(outputs1).not.toBe(outputs2);
  });

  it("generates 5 broken functions", () => {
    const d = generateRefactorData(42);
    expect(d.functions).toHaveLength(5);
  });

  it("each function has test cases", () => {
    const d = generateRefactorData(42);
    for (const fn of d.functions) {
      expect(fn.test_cases.length).toBeGreaterThanOrEqual(2);
      expect(fn.code.length).toBeGreaterThan(0);
      expect(fn.bug_description.length).toBeGreaterThan(0);
    }
  });

  it("ground truth has matching function count", () => {
    const d = generateRefactorData(42);
    expect(d.groundTruth.functions).toHaveLength(5);
  });
});

describe("Reef Refactor scoring", () => {
  const data = generateRefactorData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("is deterministic", () => {
    const sub: Record<string, unknown> = {};
    sub[gt.functions[0].id] = gt.functions[0].correct_outputs;
    const r1 = scoreRefactor({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1 });
    const r2 = scoreRefactor({ submission: sub, groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1 });
    expect(r1).toEqual(r2);
  });

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const fn of gt.functions) {
      sub[fn.id] = fn.correct_outputs;
    }
    const r = scoreRefactor({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const fn of gt.functions) {
      sub[fn.id] = fn.correct_outputs;
    }
    const r = scoreRefactor({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });

  it("empty submission gets low score", () => {
    const r = scoreRefactor({
      submission: {}, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1,
    });
    expect(r.breakdown.correctness).toBe(0);
    expect(r.breakdown.coverage).toBe(0);
  });
});

// ── Switchboard ────────────────────────────────────────────────────

describe("Switchboard data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateSwitchboardData(42);
    const d2 = generateSwitchboardData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.census).toEqual(d2.census);
  });

  it("different seeds produce different data", () => {
    const d1 = generateSwitchboardData(42);
    const d2 = generateSwitchboardData(99);
    expect(d1.groundTruth).not.toEqual(d2.groundTruth);
  });
});

describe("Switchboard scoring", () => {
  const data = generateSwitchboardData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const ans of gt.answers) {
      sub[ans.question_id] = ans.answer;
    }
    const r = scoreSwitchboard({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 5,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const ans of gt.answers) {
      sub[ans.question_id] = ans.answer;
    }
    const r = scoreSwitchboard({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 4,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Rate-Limited Recon ─────────────────────────────────────────────

describe("Rate-Limited Recon data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateReconData(42);
    const d2 = generateReconData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.citizens).toEqual(d2.citizens);
  });

  it("different seeds produce different data", () => {
    const d1 = generateReconData(42);
    const d2 = generateReconData(99);
    expect(d1.groundTruth.targets[0].citizen_id).not.toBe(d2.groundTruth.targets[0].citizen_id);
  });
});

describe("Rate-Limited Recon scoring", () => {
  const data = generateReconData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const dossiers = gt.targets.map((t) => ({
      citizen_id: t.citizen_id,
      name: t.name,
      properties: t.properties,
      total_property_value: t.total_property_value,
      vehicle_count: t.vehicle_count,
      vehicles: t.vehicles,
    }));
    const r = scoreRecon({
      submission: { dossiers, rate_limit_hits: 0 }, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 6,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = { targets: [], rate_limit_hits: 0 };
    const r = scoreRecon({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 3,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Depth-First Generation ─────────────────────────────────────────

describe("Depth-First Gen data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateDepthFirstData(42);
    const d2 = generateDepthFirstData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.spec).toEqual(d2.spec);
  });

  it("different seeds produce different data", () => {
    const d1 = generateDepthFirstData(42);
    const d2 = generateDepthFirstData(99);
    const gt1 = JSON.stringify(d1.groundTruth);
    const gt2 = JSON.stringify(d2.groundTruth);
    expect(gt1).not.toBe(gt2);
  });
});

describe("Depth-First Gen scoring", () => {
  const data = generateDepthFirstData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const t of gt.test_outputs) {
      sub[t.id] = t.expected_output;
    }
    const r = scoreDepthFirst({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const t of gt.test_outputs) {
      sub[t.id] = t.expected_output;
    }
    const r = scoreDepthFirst({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Archive Dive ───────────────────────────────────────────────────

describe("Archive Dive data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateArchiveData(42);
    const d2 = generateArchiveData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.documents).toEqual(d2.documents);
  });

  it("different seeds produce different data", () => {
    const d1 = generateArchiveData(42);
    const d2 = generateArchiveData(99);
    expect(d1.documents[0].title).not.toBe(d2.documents[0].title);
  });
});

describe("Archive Dive scoring", () => {
  const data = generateArchiveData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const ans of gt.answers) {
      sub[ans.question_id] = ans.answer;
      sub[`${ans.question_id}_evidence`] = ans.evidence;
    }
    const r = scoreArchive({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 10,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const ans of gt.answers) {
      sub[ans.question_id] = ans.answer;
      sub[`${ans.question_id}_evidence`] = ans.evidence;
    }
    const r = scoreArchive({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 5,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Contract Review ────────────────────────────────────────────────

describe("Contract Review data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateContractData(42);
    const d2 = generateContractData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.sections).toEqual(d2.sections);
  });

  it("different seeds produce different data", () => {
    const d1 = generateContractData(42);
    const d2 = generateContractData(99);
    expect(d1.groundTruth).not.toEqual(d2.groundTruth);
  });
});

describe("Contract Review scoring", () => {
  const data = generateContractData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub = {
      issues: gt.issues.map((i) => ({
        type: i.type,
        section_ids: i.section_ids,
        description: i.description,
      })),
    };
    const r = scoreContract({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 10,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub = {
      issues: gt.issues.map((i) => ({
        type: i.type,
        section_ids: i.section_ids,
        description: i.description,
      })),
    };
    const r = scoreContract({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 5,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Coral Census ───────────────────────────────────────────────────

describe("Coral Census data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateCensusData(42);
    const d2 = generateCensusData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.batches).toEqual(d2.batches);
  });

  it("different seeds produce different data", () => {
    const d1 = generateCensusData(42);
    const d2 = generateCensusData(99);
    expect(d1.groundTruth.total_final_population).not.toBe(d2.groundTruth.total_final_population);
  });
});

describe("Coral Census scoring", () => {
  const data = generateCensusData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer with checkpoints gets high score", () => {
    const cps = gt.batch_populations.map((bp) => ({ data: { populations: bp } }));
    const r = scoreCensus({
      submission: { populations: gt.final_populations, total: gt.total_final_population },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000),
      apiCallCount: 6, checkpoints: cps,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const cps = gt.batch_populations.map((bp) => ({ data: { populations: bp } }));
    const r = scoreCensus({
      submission: { populations: gt.final_populations, total: gt.total_final_population },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 5000),
      apiCallCount: 6, checkpoints: cps,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Supply Chain Marathon ──────────────────────────────────────────

describe("Supply Chain Marathon data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateSupplyChainData(42);
    const d2 = generateSupplyChainData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.products).toEqual(d2.products);
  });

  it("different seeds produce different data", () => {
    const d1 = generateSupplyChainData(42);
    const d2 = generateSupplyChainData(99);
    expect(d1.groundTruth.optimal_profit).not.toBe(d2.groundTruth.optimal_profit);
  });
});

describe("Supply Chain Marathon scoring", () => {
  const data = generateSupplyChainData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const r = scoreSupplyChain({
      submission: { profit: gt.optimal_profit, fulfillment_ratio: gt.optimal_fulfillment },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 600000),
      apiCallCount: 30,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const r = scoreSupplyChain({
      submission: { profit: gt.optimal_profit, fulfillment_ratio: gt.optimal_fulfillment },
      groundTruth: gt as any, startedAt, submittedAt: new Date(startedAt.getTime() + 60000),
      apiCallCount: 30,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Chart Forensics ────────────────────────────────────────────────

describe("Chart Forensics data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateForensicsData(42);
    const d2 = generateForensicsData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.tables).toEqual(d2.tables);
  });

  it("different seeds produce different data", () => {
    const d1 = generateForensicsData(42);
    const d2 = generateForensicsData(99);
    expect(d1.groundTruth).not.toEqual(d2.groundTruth);
  });
});

describe("Chart Forensics scoring", () => {
  const data = generateForensicsData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub = {
      issues: gt.issues.map((i) => ({
        chart_id: i.chart_id,
        issue_type: i.issue_type,
        description: i.description,
      })),
    };
    const r = scoreForensics({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 3,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub = {
      issues: gt.issues.map((i) => ({
        chart_id: i.chart_id,
        issue_type: i.issue_type,
        description: i.description,
      })),
    };
    const r = scoreForensics({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 2,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Cartographer's Eye ─────────────────────────────────────────────

describe("Cartographer's Eye data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateCartographerData(42);
    const d2 = generateCartographerData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.regions).toEqual(d2.regions);
  });

  it("different seeds produce different data", () => {
    const d1 = generateCartographerData(42);
    const d2 = generateCartographerData(99);
    expect(d1.regions[0].center_x).not.toBe(d2.regions[0].center_x);
  });
});

describe("Cartographer's Eye scoring", () => {
  const data = generateCartographerData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const ans of gt.answers) {
      sub[ans.question_id] = String(ans.answer);
    }
    sub.reasoning = { q1: "By distance calculation", q2: "Measured coordinates", q3: "BFS path", q4: "Compared radii", q5: "atan2 compass" };
    const r = scoreCartographer({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 3,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const ans of gt.answers) {
      sub[ans.question_id] = String(ans.answer);
    }
    sub.reasoning = { q1: "calc", q2: "calc", q3: "calc", q4: "calc", q5: "calc" };
    const r = scoreCartographer({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 2,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Blueprint Audit ────────────────────────────────────────────────

describe("Blueprint Audit data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateBlueprintData(42);
    const d2 = generateBlueprintData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.blueprints).toEqual(d2.blueprints);
  });

  it("different seeds produce different data", () => {
    const d1 = generateBlueprintData(42);
    const d2 = generateBlueprintData(99);
    expect(d1.groundTruth).not.toEqual(d2.groundTruth);
  });
});

describe("Blueprint Audit scoring", () => {
  const data = generateBlueprintData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub = {
      violations: gt.violations.map((v) => ({
        blueprint_id: v.blueprint_id,
        violation_type: v.violation_type,
        rule_id: v.rule_id,
        location: v.location,
        description: v.description,
      })),
    };
    const r = scoreBlueprint({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 5,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub = {
      violations: gt.violations.map((v) => ({
        blueprint_id: v.blueprint_id,
        violation_type: v.violation_type,
        rule_id: v.rule_id,
        location: v.location,
        description: v.description,
      })),
    };
    const r = scoreBlueprint({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 3,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── Adversarial Interview ──────────────────────────────────────────

describe("Adversarial Interview data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateInterviewData(42);
    const d2 = generateInterviewData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.questions).toEqual(d2.questions);
  });

  it("different seeds produce different data", () => {
    const d1 = generateInterviewData(42);
    const d2 = generateInterviewData(99);
    expect(d1.groundTruth).not.toEqual(d2.groundTruth);
  });
});

describe("Adversarial Interview scoring", () => {
  const data = generateInterviewData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub: Record<string, unknown> = {};
    for (const q of gt.questions) {
      if (q.type === "straightforward") {
        sub[q.id] = q.correct_answer;
      } else if (q.type === "false_premise") {
        sub[q.id] = "This question contains a false premise. " + q.correct_answer;
      } else {
        sub[q.id] = "This question is ambiguous. " + q.correct_answer;
      }
    }
    const r = scoreInterview({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 30000), apiCallCount: 2,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub: Record<string, unknown> = {};
    for (const q of gt.questions) {
      if (q.type === "straightforward") {
        sub[q.id] = q.correct_answer;
      } else if (q.type === "false_premise") {
        sub[q.id] = "This question contains a false premise. " + q.correct_answer;
      } else {
        sub[q.id] = "This question is ambiguous. " + q.correct_answer;
      }
    }
    const r = scoreInterview({
      submission: sub, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 1,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});

// ── The Mirage ─────────────────────────────────────────────────────

describe("The Mirage data generation", () => {
  it("is deterministic — same seed produces same data", () => {
    const d1 = generateMirageData(42);
    const d2 = generateMirageData(42);
    expect(d1.groundTruth).toEqual(d2.groundTruth);
    expect(d1.census).toEqual(d2.census);
  });

  it("different seeds produce different data", () => {
    const d1 = generateMirageData(42);
    const d2 = generateMirageData(99);
    expect(d1.groundTruth).not.toEqual(d2.groundTruth);
  });
});

describe("The Mirage scoring", () => {
  const data = generateMirageData(42);
  const gt = data.groundTruth;
  const startedAt = new Date("2026-02-01T10:00:00Z");

  it("perfect answer gets high score", () => {
    const sub = {
      fabrications: gt.fabrications.map((f) => ({
        district: f.district,
        field: f.field,
        source: f.source,
        explanation: f.explanation,
      })),
    };
    const r = scoreMirage({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 60000), apiCallCount: 5,
    });
    expect(r.breakdown.total).toBeGreaterThanOrEqual(700);
  });

  it("score never exceeds 1000", () => {
    const sub = {
      fabrications: gt.fabrications.map((f) => ({
        district: f.district,
        field: f.field,
        source: f.source,
        explanation: f.explanation,
      })),
    };
    const r = scoreMirage({
      submission: sub as any, groundTruth: gt as any, startedAt,
      submittedAt: new Date(startedAt.getTime() + 5000), apiCallCount: 3,
    });
    expect(r.breakdown.total).toBeLessThanOrEqual(1000);
  });
});
