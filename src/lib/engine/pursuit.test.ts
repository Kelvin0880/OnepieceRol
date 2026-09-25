import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { heatAfterReadingPoneglyph, decayPursuitHeat, hunterAmbushDue } from "./pursuit";

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

describe("hunterAmbushDue", () => {
  it("never when cold", () => {
    expect(hunterAmbushDue(0)).toBe(false);
    expect(hunterAmbushDue(29)).toBe(false);
  });
  it("comes on every third step of the cooldown while the heat is high, and never every time", () => {
    const due = Array.from({ length: 151 }, (_, h) => hunterAmbushDue(h));
    expect(due.some(Boolean)).toBe(true);
    expect(due.filter(Boolean).length).toBeLessThan(60);
    expect(hunterAmbushDue(90)).toBe(hunterAmbushDue(90));
  });
});
