import { describe, expect, it } from "vitest";
import { barDelta, hitFlashStrength, isBigHit, shouldDismissSheet, tiltFromPointer } from "./motion";

describe("barDelta", () => {
  it("floats the signed change when the max is unchanged", () => {
    expect(barDelta({ value: 80, max: 100 }, { value: 68, max: 100 })).toBe(-12);
    expect(barDelta({ value: 10, max: 100 }, { value: 40, max: 100 })).toBe(30);
  });
  it("floats nothing on the first reading, no change, or a new max (level up)", () => {
    expect(barDelta(null, { value: 50, max: 100 })).toBeNull();
    expect(barDelta({ value: 50, max: 100 }, { value: 50, max: 100 })).toBeNull();
    expect(barDelta({ value: 95, max: 100 }, { value: 5, max: 140 })).toBeNull();
  });
  it("rounds fractional changes and ignores ones that round to zero", () => {
    expect(barDelta({ value: 10, max: 100 }, { value: 10.3, max: 100 })).toBeNull();
    expect(barDelta({ value: 10, max: 100 }, { value: 12.6, max: 100 })).toBe(3);
  });
});

describe("isBigHit", () => {
  it("is true only for a drop at or above the threshold", () => {
    expect(isBigHit(80, 70)).toBe(true);
    expect(isBigHit(80, 75)).toBe(false);
    expect(isBigHit(50, 60)).toBe(false);
    expect(isBigHit(50, 45, 5)).toBe(true);
  });
});

describe("hitFlashStrength", () => {
  it("is zero for heals, no change or a broken max", () => {
    expect(hitFlashStrength(50, 60, 100)).toBe(0);
    expect(hitFlashStrength(50, 50, 100)).toBe(0);
    expect(hitFlashStrength(50, 40, 0)).toBe(0);
  });
  it("grows with the share of life lost and is capped", () => {
    const small = hitFlashStrength(100, 97, 100);
    const big = hitFlashStrength(100, 70, 100);
    expect(small).toBeGreaterThanOrEqual(0.3);
    expect(big).toBeGreaterThan(small);
    expect(hitFlashStrength(100, 0, 100)).toBe(0.85);
  });
});

describe("shouldDismissSheet", () => {
  it("never closes when dragged up", () => {
    expect(shouldDismissSheet(-200, 2000, 600)).toBe(false);
  });
  it("closes on a long drag or a fast flick", () => {
    expect(shouldDismissSheet(150, 0, 800)).toBe(true);
    expect(shouldDismissSheet(40, 900, 800)).toBe(true);
  });
  it("uses a shorter distance on a short sheet", () => {
    expect(shouldDismissSheet(100, 0, 300)).toBe(true);
    expect(shouldDismissSheet(100, 0, 800)).toBe(false);
  });
});

describe("tiltFromPointer", () => {
  it("is flat at the centre and on a zero-size box", () => {
    expect(tiltFromPointer(50, 50, 100, 100, 10)).toEqual({ rotateX: 0, rotateY: 0 });
    expect(tiltFromPointer(5, 5, 0, 0, 10)).toEqual({ rotateX: 0, rotateY: 0 });
  });
  it("reaches the max at the corners with the right signs", () => {
    expect(tiltFromPointer(0, 0, 100, 100, 10)).toEqual({ rotateX: 10, rotateY: -10 });
    expect(tiltFromPointer(100, 100, 100, 100, 10)).toEqual({ rotateX: -10, rotateY: 10 });
  });
  it("clamps a pointer outside the box", () => {
    expect(tiltFromPointer(500, -50, 100, 100, 8)).toEqual({ rotateX: 8, rotateY: 8 });
  });
});
