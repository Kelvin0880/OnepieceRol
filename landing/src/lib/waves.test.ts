import { describe, expect, it } from "vitest";
import { GERSTNER_GLSL, maxAmplitude, waveHeight, waveNormal, WAVES } from "./waves";

describe("waves", () => {
  it("never rises above the sum of the amplitudes", () => {
    const cap = maxAmplitude(1.45);
    for (let i = 0; i < 400; i++) {
      const x = (i * 37.1) % 300;
      const z = (i * 91.7) % 300;
      expect(Math.abs(waveHeight(x, z, i * 0.13, 1.45))).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it("scales with roughness and goes flat at zero", () => {
    expect(waveHeight(12, -40, 3, 0)).toBe(0);
    expect(maxAmplitude(1.4)).toBeCloseTo(maxAmplitude(0.7) * 2);
  });

  it("keeps the summed steepness below one even in the storm, so crests never fold over", () => {
    const steep = WAVES.reduce((s, w) => s + w.steepness, 0);
    expect(steep * 1.45).toBeLessThan(1);
  });

  it("gives a unit normal that points up", () => {
    for (let i = 0; i < 50; i++) {
      const n = waveNormal(i * 3.3, -i * 7.1, i * 0.4, 1.2);
      expect(Math.hypot(...n)).toBeCloseTo(1);
      expect(n[1]).toBeGreaterThan(0.5);
    }
  });

  it("moves over time", () => {
    expect(waveHeight(5, 5, 0, 1)).not.toBeCloseTo(waveHeight(5, 5, 1.7, 1));
  });

  it("emits one GLSL call per wave with float literals", () => {
    expect(GERSTNER_GLSL.match(/sum \+= gerstnerWave/g)).toHaveLength(WAVES.length);
    expect(GERSTNER_GLSL).toContain("#define WAVE_COUNT 5");
    expect(GERSTNER_GLSL).not.toMatch(/vec4\(\d+,/);
  });
});
