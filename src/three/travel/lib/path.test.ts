import { describe, expect, it } from "vitest";
import { shipPosition } from "./path";

describe("shipPosition", () => {
  it("starts at the origin and ends a fixed distance out along -z", () => {
    const start = shipPosition(0);
    expect(start.x).toBeCloseTo(0);
    expect(start.z).toBeCloseTo(0);
    const end = shipPosition(1);
    expect(end.z).toBeLessThan(-20);
  });

  it("moves monotonically further away (z keeps decreasing) as t increases", () => {
    let prevZ = shipPosition(0).z;
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      const { z } = shipPosition(t);
      expect(z).toBeLessThanOrEqual(prevZ + 1e-9);
      prevZ = z;
    }
  });

  it("keeps the lateral wiggle bounded", () => {
    for (let i = 0; i <= 40; i++) {
      const { x } = shipPosition(i / 40);
      expect(Math.abs(x)).toBeLessThanOrEqual(3.3);
    }
  });

  it("clamps t outside 0..1", () => {
    expect(shipPosition(-5)).toEqual(shipPosition(0));
    expect(shipPosition(5)).toEqual(shipPosition(1));
  });

  it("never returns NaN or infinite values", () => {
    for (const t of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
      const track = shipPosition(t);
      for (const v of Object.values(track)) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
