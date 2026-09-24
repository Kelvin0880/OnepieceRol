import { describe, it, expect } from "vitest";
import { pointsOwed, validateAllocation, attributeCap, intellectTacticEdge, describeAttributes, POINTS_PER_LEVEL } from "./attributes";

const base = { strength: 8, agility: 9, durability: 6, willpower: 5, intellect: 4 };

describe("pointsOwed", () => {
  it("grants nothing at level 1 and POINTS_PER_LEVEL for each level gained since the last grant", () => {
    expect(pointsOwed(1, 1)).toBe(0);
    expect(pointsOwed(1, 4)).toBe(3 * POINTS_PER_LEVEL);
    expect(pointsOwed(4, 4)).toBe(0);
  });
  it("never goes negative and tolerates a bad stored value", () => {
    expect(pointsOwed(9, 3)).toBe(0);
    expect(pointsOwed(0, 2)).toBe(POINTS_PER_LEVEL);
  });
});

describe("validateAllocation", () => {
  it("accepts a valid split and reports the durability/willpower side effects", () => {
    const r = validateAllocation(base, { durability: 2, willpower: 1 }, 4, 3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.total).toBe(3);
      expect(r.maxHpGain).toBe(6);
      expect(r.maxStaminaGain).toBe(2);
    }
  });
  it("rejects more than the available points, negatives, decimals, unknown keys and empty splits", () => {
    expect(validateAllocation(base, { strength: 5 }, 4, 5).ok).toBe(false);
    expect(validateAllocation(base, { strength: -1, agility: 3 }, 4, 5).ok).toBe(false);
    expect(validateAllocation(base, { strength: 1.5 }, 4, 5).ok).toBe(false);
    expect(validateAllocation(base, { luck: 1 } as never, 4, 5).ok).toBe(false);
    expect(validateAllocation(base, {}, 4, 5).ok).toBe(false);
  });
  it("enforces the level-based cap on a single stat", () => {
    const cap = attributeCap(2);
    const r = validateAllocation({ ...base, strength: cap }, { strength: 1 }, 4, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Fuerza");
  });
});

describe("intellectTacticEdge", () => {
  it("is small, bounded and monotonic", () => {
    expect(intellectTacticEdge(4)).toBeGreaterThanOrEqual(-1);
    expect(intellectTacticEdge(500)).toBe(6);
    expect(intellectTacticEdge(20)).toBeGreaterThan(intellectTacticEdge(8));
  });
});

describe("describeAttributes", () => {
  it("names every attribute with a strength word", () => {
    const d = describeAttributes({ strength: 70, agility: 30, durability: 12, willpower: 5, intellect: 45 });
    expect(d).toContain("Fuerza 70 (descomunal)");
    expect(d).toContain("Voluntad 5 (modesta)");
    expect(d).toContain("Intelecto 45 (sobresaliente)");
  });
});
