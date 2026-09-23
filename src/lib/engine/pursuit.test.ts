import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { heatAfterReadingPoneglyph, decayPursuitHeat, hunterAmbushChance, rollHunterAmbush } from "./pursuit";

describe("heatAfterReadingPoneglyph", () => {
  it("increases heat", () => {
    expect(heatAfterReadingPoneglyph(0)).toBeGreaterThan(0);
  });

  it("caps at a maximum even after many reads", () => {
    let heat = 0;
    for (let i = 0; i < 10; i++) heat = heatAfterReadingPoneglyph(heat);
    expect(heat).toBeLessThanOrEqual(150);
  });
});

describe("decayPursuitHeat", () => {
  it("decreases heat", () => {
    expect(decayPursuitHeat(50)).toBeLessThan(50);
  });

  it("never goes below zero", () => {
    expect(decayPursuitHeat(1)).toBeGreaterThanOrEqual(0);
    expect(decayPursuitHeat(0)).toBe(0);
  });

  it("eventually reaches zero through repeated decay", () => {
    let heat = 50;
    for (let i = 0; i < 100; i++) heat = decayPursuitHeat(heat);
    expect(heat).toBe(0);
  });
});

describe("hunterAmbushChance", () => {
  it("is zero at zero heat", () => {
    expect(hunterAmbushChance(0)).toBe(0);
  });

  it("increases with heat", () => {
    expect(hunterAmbushChance(100)).toBeGreaterThan(hunterAmbushChance(20));
  });

  it("never exceeds the cap even at max heat", () => {
    expect(hunterAmbushChance(150)).toBeLessThanOrEqual(0.35);
  });
});

describe("rollHunterAmbush", () => {
  it("never fires at zero heat", () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(rollHunterAmbush(mulberry32(seed), 0)).toBe(false);
    }
  });

  it("fires sometimes at high heat across many seeds", () => {
    let hits = 0;
    const trials = 500;
    for (let seed = 0; seed < trials; seed++) {
      if (rollHunterAmbush(mulberry32(seed), 150)) hits++;
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits / trials).toBeLessThan(0.5);
  });
});
