import { describe, expect, it } from "vitest";
import { ENV_KEYS, hexToLinear, sampleEnv, sunDirection, toCss } from "./env";
import { MAX_SEA } from "./voyage";

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

describe("sampleEnv", () => {
  it("has one mood per stop of the route", () => {
    expect(ENV_KEYS).toHaveLength(MAX_SEA + 1);
  });

  it("returns each stop exactly at its integer", () => {
    for (let i = 0; i <= MAX_SEA; i++) {
      const env = sampleEnv(i);
      expect(env.rough).toBeCloseTo(ENV_KEYS[i].rough);
      expect(env.skyTop).toEqual(hexToLinear(ENV_KEYS[i].skyTop).map((c) => expect.closeTo(c, 6)));
    }
  });

  it("blends between stops and clamps outside the route", () => {
    const mid = sampleEnv(2.5).rough;
    expect(mid).toBeGreaterThan(Math.min(ENV_KEYS[2].rough, ENV_KEYS[3].rough));
    expect(mid).toBeLessThan(Math.max(ENV_KEYS[2].rough, ENV_KEYS[3].rough));
    expect(sampleEnv(-5).rough).toBeCloseTo(ENV_KEYS[0].rough);
    expect(sampleEnv(99).glory).toBeCloseTo(ENV_KEYS[MAX_SEA].glory);
  });

  it("keeps the sun direction a unit vector and reuses the object it is given", () => {
    const out = sampleEnv(0);
    const same = sampleEnv(1.3, out);
    expect(same).toBe(out);
    expect(Math.hypot(...same.sunDir)).toBeCloseTo(1);
  });

  it("only the storm brings rain and lightning", () => {
    expect(sampleEnv(0).rain).toBe(0);
    expect(sampleEnv(3).rain).toBe(1);
    expect(sampleEnv(3).lightning).toBe(1);
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
