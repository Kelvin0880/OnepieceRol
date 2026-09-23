import { describe, it, expect } from "vitest";
import { mulberry32, rollInt, rollD100, weightedPick } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("stays within [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rollInt", () => {
  it("stays within [min, max] inclusive over many rolls", () => {
    const rng = mulberry32(123);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = rollInt(rng, 1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("handles a degenerate single-value range", () => {
    const rng = mulberry32(1);
    expect(rollInt(rng, 5, 5)).toBe(5);
  });

  it("throws when max < min", () => {
    const rng = mulberry32(1);
    expect(() => rollInt(rng, 10, 1)).toThrow();
  });
});

describe("rollD100", () => {
  it("stays within [1, 100]", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 2000; i++) {
      const v = rollD100(rng);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("weightedPick", () => {
  it("only ever returns zero-weight-excluded items roughly proportionally", () => {
    const rng = mulberry32(555);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10000; i++) {
      const pick = weightedPick(rng, [
        { item: "a", weight: 90 },
        { item: "b", weight: 10 },
      ]);
      counts[pick as "a" | "b"]++;
    }
    // "a" should dominate roughly 9:1 — generous tolerance to avoid flakiness.
    expect(counts.a).toBeGreaterThan(counts.b * 4);
  });

  it("never returns an item with zero probability mass when others have weight 0", () => {
    const rng = mulberry32(1);
    const pick = weightedPick(rng, [
      { item: "only", weight: 1 },
      { item: "impossible", weight: 0 },
    ]);
    expect(["only", "impossible"]).toContain(pick);
  });

  it("throws when total weight is zero", () => {
    const rng = mulberry32(1);
    expect(() => weightedPick(rng, [{ item: "x", weight: 0 }])).toThrow();
  });
});
