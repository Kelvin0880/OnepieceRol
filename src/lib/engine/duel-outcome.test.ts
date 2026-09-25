import { describe, expect, it } from "vitest";
import { REWARD_CAP, captureReward, verdictOptions } from "./duel-outcome";

describe("verdictOptions", () => {
  it("the Government imprisons wanted outsiders", () => {
    for (const w of ["MARINE", "CP0"]) {
      const o = verdictOptions(w, "PIRATE");
      expect(o).toMatchObject({ canCapture: true, captureMode: "impel" });
      expect(o.captureLabel).toContain("Impel Down");
    }
  });
  it("everyone else sells the captive to the Marines", () => {
    for (const w of ["PIRATE", "REVOLUTIONARY", "BOUNTY_HUNTER"]) {
      expect(verdictOptions(w, "PIRATE")).toMatchObject({ canCapture: true, captureMode: "sell" });
    }
  });
  it("a Marine or CP-0 loser cannot be captured, but can always be killed or spared", () => {
    for (const l of ["MARINE", "CP0"]) {
      for (const w of ["PIRATE", "MARINE", "REVOLUTIONARY"]) {
        const o = verdictOptions(w, l);
        expect(o.canCapture).toBe(false);
        expect(o.captureMode).toBeNull();
        expect(o.kill && o.spare).toBe(true);
      }
    }
  });
  it("a Shichibukai cannot be arrested by the Government, but a bounty hunter can still sell them", () => {
    for (const w of ["MARINE", "CP0"]) expect(verdictOptions(w, "PIRATE", true).canCapture).toBe(false);
    expect(verdictOptions("BOUNTY_HUNTER", "PIRATE", true)).toMatchObject({ canCapture: true, captureMode: "sell" });
  });
});

describe("captureReward", () => {
  it("pays a tenth of a pirate's bounty", () => {
    expect(captureReward("PIRATE", 30_000_000, 0)).toBe(3_000_000);
  });
  it("pays others by notoriety", () => {
    expect(captureReward("REVOLUTIONARY", 0, 800)).toBe(400_000);
  });
  it("is capped and never negative", () => {
    expect(captureReward("PIRATE", 2_000_000_000, 0)).toBe(REWARD_CAP);
    expect(captureReward("PIRATE", -5, 0)).toBe(0);
    expect(captureReward("PIRATE", 0, 0)).toBe(0);
  });
});
