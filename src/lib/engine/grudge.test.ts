import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { heatAfterGrudgeIncident, heatAfterMercy, decayGrudgeHeat, grudgeAmbushDue, MAX_GRUDGE_HEAT } from "./grudge";

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

describe("grudgeAmbushDue", () => {
  it("never at zero or low heat", () => {
    expect(grudgeAmbushDue(0)).toBe(false);
    expect(grudgeAmbushDue(10)).toBe(false);
  });
  it("comes on a fixed cadence while the grudge is hot, and is the same every time for the same heat", () => {
    const due = Array.from({ length: 150 }, (_, h) => grudgeAmbushDue(h));
    expect(due.some(Boolean)).toBe(true);
    expect(due.filter(Boolean).length).toBeLessThan(75);
    expect(grudgeAmbushDue(100)).toBe(grudgeAmbushDue(100));
  });
});
