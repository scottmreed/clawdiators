import { describe, it, expect } from "vitest";
import { calculateElo, scoreToResult } from "../src/services/elo.js";

describe("Elo calculation", () => {
  it("win against equal-rated opponent gives +16 for new agents", () => {
    const result = calculateElo(1000, 1000, "win", 5);
    expect(result.newRating).toBe(1016);
    expect(result.change).toBe(16);
  });

  it("loss against equal-rated opponent gives -16 for new agents", () => {
    const result = calculateElo(1000, 1000, "loss", 5);
    expect(result.newRating).toBe(984);
    expect(result.change).toBe(-16);
  });

  it("draw against equal-rated opponent gives 0 change", () => {
    const result = calculateElo(1000, 1000, "draw", 5);
    expect(result.newRating).toBe(1000);
    expect(result.change).toBe(0);
  });

  it("uses K=32 for <30 matches, K=16 for 30+", () => {
    const newAgent = calculateElo(1000, 1000, "win", 10);
    const vetAgent = calculateElo(1000, 1000, "win", 50);
    expect(newAgent.change).toBe(16); // K=32, S-E = 0.5
    expect(vetAgent.change).toBe(8); // K=16, S-E = 0.5
  });

  it("win against higher-rated opponent gives more Elo", () => {
    const result = calculateElo(1000, 1400, "win", 5);
    expect(result.change).toBeGreaterThan(16); // More than even-rated win
  });

  it("loss against lower-rated opponent loses more Elo", () => {
    const result = calculateElo(1400, 1000, "loss", 5);
    expect(result.change).toBeLessThan(-16); // More than even-rated loss
  });

  it("never drops below Elo floor of 100", () => {
    const result = calculateElo(100, 2000, "loss", 5);
    expect(result.newRating).toBe(100);
  });
});

describe("scoreToResult", () => {
  it("score >= 700 is win", () => {
    expect(scoreToResult(700)).toBe("win");
    expect(scoreToResult(1000)).toBe("win");
  });

  it("score 400-699 is draw", () => {
    expect(scoreToResult(400)).toBe("draw");
    expect(scoreToResult(699)).toBe("draw");
  });

  it("score < 400 is loss", () => {
    expect(scoreToResult(399)).toBe("loss");
    expect(scoreToResult(0)).toBe("loss");
  });
});
