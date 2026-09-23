import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { attemptPrisonRescue, rescueSucceeded } from "./rescue";

describe("attemptPrisonRescue", () => {
  it("a much stronger rescuer succeeds reliably across many seeds", () => {
    let successes = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      const result = attemptPrisonRescue(mulberry32(seed), 200, 50);
      if (rescueSucceeded(result)) successes++;
    }
    expect(successes / trials).toBeGreaterThan(0.9);
  });

  it("a much weaker rescuer rarely succeeds, but not never", () => {
    let successes = 0;
    const trials = 500;
    for (let seed = 0; seed < trials; seed++) {
      const result = attemptPrisonRescue(mulberry32(seed), 10, 200);
      if (rescueSucceeded(result)) successes++;
    }
    expect(successes / trials).toBeLessThan(0.15);
    expect(successes).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed", () => {
    const a = attemptPrisonRescue(mulberry32(7), 100, 100);
    const b = attemptPrisonRescue(mulberry32(7), 100, 100);
    expect(a).toEqual(b);
  });

  it("rescueSucceeded matches the success/critical_success outcomes only", () => {
    for (let seed = 0; seed < 200; seed++) {
      const result = attemptPrisonRescue(mulberry32(seed), 100, 100);
      const expected = result.outcome === "success" || result.outcome === "critical_success";
      expect(rescueSucceeded(result)).toBe(expected);
    }
  });
});
