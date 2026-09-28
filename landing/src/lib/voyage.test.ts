import { describe, expect, it } from "vitest";
import { buildAnchors, MAX_SEA, presence, seaAt, smoothstep, stopIndexAt } from "./voyage";

describe("seaAt", () => {
  const anchors = buildAnchors([
    { y: 1000, sea: 1 },
    { y: 400, sea: 0 },
    { y: 2000, sea: 3 },
  ]);

  it("sorts anchors by y", () => {
    expect(anchors.map((a) => a.y)).toEqual([400, 1000, 2000]);
  });

  it("holds the first sea above the first anchor and the last below the last", () => {
    expect(seaAt(anchors, 0)).toBe(0);
    expect(seaAt(anchors, 5000)).toBe(3);
  });

  it("interpolates linearly between section centres", () => {
    expect(seaAt(anchors, 700)).toBeCloseTo(0.5);
    expect(seaAt(anchors, 1500)).toBeCloseTo(2);
  });

  it("is 0 with no anchors and clamps anchors to the route", () => {
    expect(seaAt([], 300)).toBe(0);
    expect(buildAnchors([{ y: 1, sea: 99 }])[0].sea).toBe(MAX_SEA);
    expect(buildAnchors([{ y: Number.NaN, sea: 1 }])).toEqual([]);
  });

  it("does not divide by zero when two anchors share a y", () => {
    const same = buildAnchors([{ y: 100, sea: 1 }, { y: 100, sea: 2 }]);
    expect(Number.isFinite(seaAt(same, 100))).toBe(true);
  });
});

describe("stops and presence", () => {
  it("rounds to the nearest stop within the route", () => {
    expect(stopIndexAt(1.4)).toBe(1);
    expect(stopIndexAt(1.6)).toBe(2);
    expect(stopIndexAt(-3)).toBe(0);
    expect(stopIndexAt(40)).toBe(MAX_SEA);
  });

  it("is fully present at its centre and gone far away", () => {
    expect(presence(2, 2)).toBe(1);
    expect(presence(0, 2)).toBe(0);
    expect(presence(4, 2)).toBe(0);
    const edge = presence(1.4, 2);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });

  it("smoothstep is clamped and handles a zero-width edge", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothstep(1, 1, 0.5)).toBe(0);
    expect(smoothstep(1, 1, 2)).toBe(1);
  });
});
