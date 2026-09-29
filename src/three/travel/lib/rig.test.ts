import { describe, expect, it } from "vitest";
import { sampleRig, smoothstep } from "./rig";

describe("smoothstep", () => {
  it("clamps and eases between two edges", () => {
    expect(smoothstep(0, 1, -5)).toBe(0);
    expect(smoothstep(0, 1, 5)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it("handles equal edges without dividing by zero", () => {
    expect(smoothstep(2, 2, 1)).toBe(0);
    expect(smoothstep(2, 2, 3)).toBe(1);
  });
});

describe("sampleRig", () => {
  it("produces finite, bounded output across the whole clip at a wide aspect ratio", () => {
    for (let i = 0; i <= 10; i++) {
      const cam: [number, number, number] = [0, 0, 0];
      const look: [number, number, number] = [0, 0, 0];
      sampleRig(i / 10, 1.9, cam, look);
      for (const v of [...cam, ...look]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(30);
      }
    }
  });

  it("produces finite, bounded output at a phone (tall) aspect ratio", () => {
    for (let i = 0; i <= 10; i++) {
      const cam: [number, number, number] = [0, 0, 0];
      const look: [number, number, number] = [0, 0, 0];
      sampleRig(i / 10, 0.45, cam, look);
      for (const v of [...cam, ...look]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(30);
      }
    }
  });

  it("blends smoothly between the wide and tall rigs at an in-between aspect ratio", () => {
    const camWide: [number, number, number] = [0, 0, 0];
    const camTall: [number, number, number] = [0, 0, 0];
    const camMid: [number, number, number] = [0, 0, 0];
    sampleRig(0.5, 1.9, camWide, [0, 0, 0]);
    sampleRig(0.5, 0.45, camTall, [0, 0, 0]);
    sampleRig(0.5, 0.75, camMid, [0, 0, 0]);
    // The blended camera position should land strictly between the two pure rigs on at least one axis.
    const between = camMid.some((v, i) => v >= Math.min(camWide[i], camTall[i]) - 1e-9 && v <= Math.max(camWide[i], camTall[i]) + 1e-9);
    expect(between).toBe(true);
  });

  it("clamps identically at and beyond the clip's ends", () => {
    const a: [number, number, number] = [0, 0, 0];
    const b: [number, number, number] = [0, 0, 0];
    sampleRig(0, 1.9, a, [0, 0, 0]);
    sampleRig(-2, 1.9, b, [0, 0, 0]);
    expect(a).toEqual(b);
  });
});
