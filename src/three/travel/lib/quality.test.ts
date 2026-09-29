import { describe, expect, it } from "vitest";
import { pickTier } from "./quality";

const base = { webgl: true, reducedMotion: false, coarsePointer: false, width: 1280 };

describe("pickTier", () => {
  it("is on for a capable desktop", () => {
    expect(pickTier(base)).toBe("on");
  });

  it("is off with no WebGL, regardless of everything else", () => {
    expect(pickTier({ ...base, webgl: false })).toBe("off");
  });

  it("is off when the user asked for reduced motion", () => {
    expect(pickTier({ ...base, reducedMotion: true })).toBe("off");
  });

  it("is off when the browser reports data-saver mode", () => {
    expect(pickTier({ ...base, saveData: true })).toBe("off");
  });

  it("is off on very low memory or very few cores", () => {
    expect(pickTier({ ...base, memoryGb: 2 })).toBe("off");
    expect(pickTier({ ...base, cores: 2 })).toBe("off");
    expect(pickTier({ ...base, memoryGb: 4 })).toBe("on");
  });

  it("is off on a coarse pointer with a weak CPU, on with a strong one", () => {
    expect(pickTier({ ...base, coarsePointer: true, cores: 4 })).toBe("off");
    expect(pickTier({ ...base, coarsePointer: true, cores: 8 })).toBe("on");
  });

  it("is on for a coarse-pointer phone with unknown core count", () => {
    expect(pickTier({ ...base, coarsePointer: true, width: 390 })).toBe("on");
  });
});
