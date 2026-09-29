import { describe, expect, it } from "vitest";
import { hexToLinear, pickMood, sunDirection, toCss } from "./env";

describe("colours", () => {
  it("converts sRGB hex to linear light", () => {
    expect(hexToLinear("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToLinear("#000000")).toEqual([0, 0, 0]);
    const mid = hexToLinear("#808080")[0];
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.23);
  });

  it("round-trips back to CSS", () => {
    expect(toCss(hexToLinear("#d4a94a"))).toBe("rgb(212, 169, 74)");
  });

  it("throws on a malformed colour", () => {
    expect(() => hexToLinear("#12")).toThrow();
  });
});

describe("sunDirection", () => {
  it("points ahead (-z) at azimuth 0 and up at 90 degrees", () => {
    const ahead = sunDirection(0, 0);
    expect(ahead[2]).toBeCloseTo(-1);
    expect(sunDirection(90, 0)[1]).toBeCloseTo(1);
    expect(sunDirection(0, 90)[0]).toBeCloseTo(1);
  });
});

describe("pickMood", () => {
  it("uses the sea's base mood when the island name has no override", () => {
    const eastBlue = pickMood("EAST_BLUE", "Isla Cualquiera", 3);
    const paradise = pickMood("PARADISE", "Isla Cualquiera", 3);
    const newWorld = pickMood("NEW_WORLD", "Isla Cualquiera", 3);
    expect(eastBlue.skyTop).not.toEqual(paradise.skyTop);
    expect(paradise.skyTop).not.toEqual(newWorld.skyTop);
  });

  it("falls back to East Blue for the three unused Blues and for an unrecognized sea", () => {
    const east = pickMood("EAST_BLUE", "X", 1);
    expect(pickMood("WEST_BLUE", "X", 1).skyTop).toEqual(east.skyTop);
    expect(pickMood("NORTH_BLUE", "X", 1).skyTop).toEqual(east.skyTop);
    expect(pickMood("SOUTH_BLUE", "X", 1).skyTop).toEqual(east.skyTop);
    expect(pickMood("NOT_A_REAL_SEA", "X", 1).skyTop).toEqual(east.skyTop);
  });

  it("an exact island-name override wins over the sea's base mood", () => {
    // Reverse Mountain is seeded with sea: EAST_BLUE but should render its own distinct override mood.
    const overridden = pickMood("EAST_BLUE", "Reverse Mountain", 6);
    const plainEastBlue = pickMood("EAST_BLUE", "Isla Cualquiera", 6);
    expect(overridden.skyTop).not.toEqual(plainEastBlue.skyTop);

    const laughTale = pickMood("NEW_WORLD", "Laugh Tale", 10);
    const plainNewWorld = pickMood("NEW_WORLD", "Isla Cualquiera", 10);
    expect(laughTale.skyTop).not.toEqual(plainNewWorld.skyTop);
  });

  it("scales storminess with dangerLevel, bounded at both ends", () => {
    const calm = pickMood("EAST_BLUE", "X", 1);
    const dangerous = pickMood("EAST_BLUE", "X", 10);
    expect(dangerous.rough).toBeGreaterThan(calm.rough);
    expect(dangerous.foam).toBeGreaterThanOrEqual(calm.foam);
    expect(dangerous.foam).toBeLessThanOrEqual(1);
    // dangerLevel outside the documented 1-10 range still returns sane, bounded output.
    const clampedLow = pickMood("EAST_BLUE", "X", -5);
    const clampedHigh = pickMood("EAST_BLUE", "X", 99);
    expect(clampedLow.rough).toBeCloseTo(calm.rough);
    expect(clampedHigh.rough).toBeCloseTo(dangerous.rough);
  });

  it("keeps the sun direction a unit vector", () => {
    const env = pickMood("PARADISE", "X", 5);
    expect(Math.hypot(...env.sunDir)).toBeCloseTo(1);
  });
});
