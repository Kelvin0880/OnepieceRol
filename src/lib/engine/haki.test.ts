import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { trainHaki, rollConquerorsHakiAwakening } from "./haki";

describe("trainHaki", () => {
  it("never trains past 100", () => {
    const rng = mulberry32(1);
    const result = trainHaki(rng, 100, 50);
    expect(result.gained).toBe(0);
  });

  it("never overshoots the 100 cap even near the ceiling", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const result = trainHaki(rng, 98, 50);
      expect(98 + result.gained).toBeLessThanOrEqual(100);
    }
  });

  it("gained is never negative", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const result = trainHaki(rng, 30, 10);
      expect(result.gained).toBeGreaterThanOrEqual(0);
    }
  });

  it("higher willpower trends toward more total gain across many sessions", () => {
    let lowTotal = 0;
    let highTotal = 0;
    for (let seed = 0; seed < 300; seed++) {
      lowTotal += trainHaki(mulberry32(seed), 20, 2).gained;
      highTotal += trainHaki(mulberry32(seed + 100000), 20, 50).gained;
    }
    expect(highTotal).toBeGreaterThan(lowTotal);
  });
});

describe("rollConquerorsHakiAwakening", () => {
  it("is rare even at max willpower", () => {
    let hits = 0;
    const trials = 2000;
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed);
      if (rollConquerorsHakiAwakening(rng, 999)) hits++;
    }
    // Capped at 8% chance per roll -> expect well under half the trials to hit.
    expect(hits / trials).toBeLessThan(0.15);
    expect(hits).toBeGreaterThan(0);
  });

  it("almost never triggers at zero willpower", () => {
    let hits = 0;
    const trials = 2000;
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed);
      if (rollConquerorsHakiAwakening(rng, 0)) hits++;
    }
    expect(hits / trials).toBeLessThan(0.05);
  });
});
