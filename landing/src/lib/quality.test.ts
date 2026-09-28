import { describe, expect, it } from "vitest";
import { lowerTier, pickTier, TIER_SETTINGS, type DeviceHints } from "./quality";

const desktop: DeviceHints = { webgl: true, reducedMotion: false, coarsePointer: false, width: 1440, cores: 12, memoryGb: 16 };

describe("pickTier", () => {
  it("gives a strong desktop the full scene", () => {
    expect(pickTier(desktop)).toBe("high");
  });

  it("skips 3D only without WebGL; reduced motion keeps the scene (it is calmed elsewhere)", () => {
    expect(pickTier({ ...desktop, webgl: false })).toBe("none");
    expect(pickTier({ ...desktop, reducedMotion: true })).toBe("high");
  });

  it("keeps phones on a lighter scene", () => {
    expect(pickTier({ ...desktop, coarsePointer: true, width: 390, cores: 8, memoryGb: 6 })).toBe("medium");
    expect(pickTier({ ...desktop, coarsePointer: true, width: 390, cores: 4 })).toBe("low");
  });

  it("drops to the lightest scene on weak or data-saving devices", () => {
    expect(pickTier({ ...desktop, memoryGb: 2 })).toBe("low");
    expect(pickTier({ ...desktop, cores: 2 })).toBe("low");
    expect(pickTier({ ...desktop, saveData: true })).toBe("low");
  });

  it("treats a narrow window or little memory as medium", () => {
    expect(pickTier({ ...desktop, width: 800 })).toBe("medium");
    expect(pickTier({ ...desktop, memoryGb: 4 })).toBe("medium");
  });

  it("works when the browser hides cores and memory", () => {
    expect(pickTier({ webgl: true, reducedMotion: false, coarsePointer: false, width: 1280 })).toBe("high");
  });
});

describe("tiers", () => {
  it("steps down and bottoms out at low", () => {
    expect(lowerTier("high")).toBe("medium");
    expect(lowerTier("medium")).toBe("low");
    expect(lowerTier("low")).toBe("low");
  });

  it("asks less of the GPU on every step down", () => {
    expect(TIER_SETTINGS.high.oceanRadial).toBeGreaterThan(TIER_SETTINGS.medium.oceanRadial);
    expect(TIER_SETTINGS.medium.oceanRadial).toBeGreaterThan(TIER_SETTINGS.low.oceanRadial);
    expect(TIER_SETTINGS.low.postprocessing).toBe("off");
  });
});
