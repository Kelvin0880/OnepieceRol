import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { skillCheck, encounterDifficulty } from "./checks";

describe("skillCheck", () => {
  it("rolls 1-5 are always critical_fail regardless of modifier", () => {
    // Find a seed whose first roll lands <= 5 by scanning seeds (deterministic, no flakiness).
    let found = false;
    for (let seed = 0; seed < 2000 && !found; seed++) {
      const rng = mulberry32(seed);
      const result = skillCheck(rng, 999, 1);
      if (result.roll <= 5) {
        expect(result.outcome).toBe("critical_fail");
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("rolls 96-100 are always critical_success regardless of modifier", () => {
    let found = false;
    for (let seed = 0; seed < 2000 && !found; seed++) {
      const rng = mulberry32(seed);
      const result = skillCheck(rng, -999, 1);
      if (result.roll >= 96) {
        expect(result.outcome).toBe("critical_success");
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("succeeds when total meets or exceeds difficulty (outside crit bands)", () => {
    const rng = mulberry32(4242);
    const result = skillCheck(rng, 50, 10);
    if (result.roll > 5 && result.roll < 96) {
      expect(result.outcome).toBe("success");
      expect(result.margin).toBeGreaterThanOrEqual(0);
    }
  });

  it("fails when total is below difficulty (outside crit bands)", () => {
    const rng = mulberry32(4242);
    const result = skillCheck(rng, -50, 90);
    if (result.roll > 5 && result.roll < 96) {
      expect(result.outcome).toBe("fail");
      expect(result.margin).toBeLessThan(0);
    }
  });

  it("margin is always total - difficulty", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const result = skillCheck(rng, 10, 30);
      expect(result.margin).toBe(result.total - result.difficulty);
      expect(result.total).toBe(result.roll + result.modifier);
    }
  });
});

describe("encounterDifficulty", () => {
  it("increases with island danger", () => {
    const low = encounterDifficulty(1, 1);
    const high = encounterDifficulty(10, 1);
    expect(high).toBeGreaterThan(low);
  });

  it("is softened by character level, but never trivial", () => {
    const dc1 = encounterDifficulty(5, 1);
    const dc50 = encounterDifficulty(5, 50);
    expect(dc50).toBeLessThan(dc1);
    expect(dc50).toBeGreaterThanOrEqual(5); // floor
  });

  it("stays within [5, 99] for extreme inputs", () => {
    expect(encounterDifficulty(1, 999)).toBeGreaterThanOrEqual(5);
    expect(encounterDifficulty(10, 0)).toBeLessThanOrEqual(99);
  });
});
