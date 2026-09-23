import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { heatAfterGrudgeIncident, heatAfterMercy, decayGrudgeHeat, grudgeAmbushChance, rollGrudgeAmbush, MAX_GRUDGE_HEAT } from "./grudge";

describe("heatAfterGrudgeIncident", () => {
  it("increases heat on escape", () => {
    expect(heatAfterGrudgeIncident(0, "escape")).toBeGreaterThan(0);
  });

  it("increases heat on subordinate defeat", () => {
    expect(heatAfterGrudgeIncident(0, "subordinate_defeat")).toBeGreaterThan(0);
  });

  it("escaping stings more than a clean subordinate defeat", () => {
    expect(heatAfterGrudgeIncident(0, "escape")).toBeGreaterThan(heatAfterGrudgeIncident(0, "subordinate_defeat"));
  });

  it("humbling the holder in person is remembered longer than beating a subordinate", () => {
    expect(heatAfterGrudgeIncident(0, "actor_defeat")).toBeGreaterThan(heatAfterGrudgeIncident(0, "escape"));
  });

  it("caps at a maximum even after many incidents", () => {
    let heat = 0;
    for (let i = 0; i < 20; i++) heat = heatAfterGrudgeIncident(heat, "escape");
    expect(heat).toBeLessThanOrEqual(MAX_GRUDGE_HEAT);
  });
});

describe("heatAfterMercy", () => {
  it("decreases heat", () => {
    expect(heatAfterMercy(50)).toBeLessThan(50);
  });

  it("never goes below zero", () => {
    expect(heatAfterMercy(5)).toBeGreaterThanOrEqual(0);
    expect(heatAfterMercy(0)).toBe(0);
  });
});

describe("decayGrudgeHeat", () => {
  it("decreases heat", () => {
    expect(decayGrudgeHeat(50)).toBeLessThan(50);
  });

  it("never goes below zero", () => {
    expect(decayGrudgeHeat(1)).toBeGreaterThanOrEqual(0);
    expect(decayGrudgeHeat(0)).toBe(0);
  });

  it("eventually reaches zero through repeated decay", () => {
    let heat = 50;
    for (let i = 0; i < 100; i++) heat = decayGrudgeHeat(heat);
    expect(heat).toBe(0);
  });
});

describe("grudgeAmbushChance", () => {
  it("is zero at zero heat", () => {
    expect(grudgeAmbushChance(0)).toBe(0);
  });

  it("increases with heat", () => {
    expect(grudgeAmbushChance(100)).toBeGreaterThan(grudgeAmbushChance(20));
  });

  it("never exceeds the cap even at max heat", () => {
    expect(grudgeAmbushChance(MAX_GRUDGE_HEAT)).toBeLessThanOrEqual(0.3);
  });
});

describe("rollGrudgeAmbush", () => {
  it("never fires at zero heat", () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(rollGrudgeAmbush(mulberry32(seed), 0)).toBe(false);
    }
  });

  it("fires sometimes at high heat across many seeds", () => {
    let hits = 0;
    const trials = 500;
    for (let seed = 0; seed < trials; seed++) {
      if (rollGrudgeAmbush(mulberry32(seed), MAX_GRUDGE_HEAT)) hits++;
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits / trials).toBeLessThan(0.5);
  });
});
