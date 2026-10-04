import { describe, expect, it } from "vitest";
import {
  autoTrainingFocus,
  capGain,
  FULL_MASTERY_LEVEL,
  isLevelCapped,
  isTrainingMaxed,
  levelCap,
  resolveTrainingFocus,
  settleBank,
  trainingCeiling,
  trainingReadyInMs,
  TRAINING_COOLDOWN_MS,
  type TrainingState,
} from "./training";

const s = (armamentHaki: number, observationHaki: number, fruitMastery = 0, hasFruit = false, level = 50): TrainingState => ({ level, armamentHaki, observationHaki, fruitMastery, hasFruit });

describe("levelCap", () => {
  it("starts at 10 and grows 4 per level", () => {
    expect(levelCap(1)).toBe(10);
    expect(levelCap(2)).toBe(14);
    expect(levelCap(8)).toBe(38);
  });

  // The owner's two rules: a level 7-8 character can't be near the top, but the top must not need an absurd level.
  it("keeps a level 8 character well under half, and opens the full 100 at the New World gate", () => {
    expect(levelCap(8)).toBeLessThan(50);
    expect(FULL_MASTERY_LEVEL).toBe(24);
    expect(levelCap(23)).toBeLessThan(100);
    expect(levelCap(24)).toBe(100);
    expect(levelCap(60)).toBe(100);
  });

  it("never breaks on a weird level", () => {
    expect(levelCap(0)).toBe(10);
    expect(levelCap(Number.NaN)).toBe(10);
  });
});

describe("capGain", () => {
  it("lets a gain through up to the ceiling and never goes negative", () => {
    expect(capGain(30, 5, 38)).toBe(5);
    expect(capGain(36, 5, 38)).toBe(2);
    expect(capGain(38, 5, 38)).toBe(0);
    expect(capGain(71, 5, 34)).toBe(0);
  });
});

describe("settleBank", () => {
  // Real case (Sebastian, 2026-10-04): level 7, Haki 71 — the cap is 34, the other 37 are kept, not deleted.
  it("moves what is above the ceiling into the reserve, losing nothing", () => {
    expect(settleBank(71, 0, levelCap(7))).toEqual({ value: 34, bank: 37 });
  });

  it("gives banked points back as the ceiling rises", () => {
    expect(settleBank(34, 37, levelCap(8))).toEqual({ value: 38, bank: 33 });
    expect(settleBank(38, 33, levelCap(17))).toEqual({ value: 71, bank: 0 });
  });

  // Real case (Barbosa): level 8, Armament 42 -> 38 with 4 banked; one level later it is all back.
  it("returns everything once the level allows it", () => {
    const banked = settleBank(42, 0, levelCap(8));
    expect(banked).toEqual({ value: 38, bank: 4 });
    expect(settleBank(banked.value, banked.bank, levelCap(9))).toEqual({ value: 42, bank: 0 });
  });

  it("is idempotent and leaves a stat within its ceiling untouched", () => {
    expect(settleBank(20, 0, 38)).toEqual({ value: 20, bank: 0 });
    const once = settleBank(71, 0, 34);
    expect(settleBank(once.value, once.bank, 34)).toEqual(once);
  });
});

describe("autoTrainingFocus", () => {
  // Real case (Barbosa, 2026-10-04): 42 / 41 / 38 — the fruit is furthest behind, so "auto" trains it.
  it("trains the fruit when it is the furthest behind", () => {
    expect(autoTrainingFocus(s(42, 41, 38, true))).toBe("fruit");
  });

  it("goes back to Haki once the fruit catches up", () => {
    expect(autoTrainingFocus(s(42, 41, 41, true))).toBe("observation");
    expect(autoTrainingFocus(s(41, 42, 45, true))).toBe("armament");
  });

  it("never picks the fruit for someone without one", () => {
    expect(autoTrainingFocus(s(10, 20, 0, false))).toBe("armament");
  });

  it("breaks ties towards Haki, armament first", () => {
    expect(autoTrainingFocus(s(5, 5, 5, true))).toBe("armament");
    expect(autoTrainingFocus(s(0, 0))).toBe("armament");
  });

  it("skips a stat already at its ceiling while another can still grow", () => {
    expect(autoTrainingFocus(s(100, 100, 60, true))).toBe("fruit");
    expect(autoTrainingFocus(s(100, 70, 100, true))).toBe("observation");
  });

  it("counts the level's ceiling, not just the absolute max", () => {
    // Level 8 (cap 38): Armament is already at the cap, so auto trains the lower one that can still grow.
    expect(autoTrainingFocus(s(38, 30, 35, true, 8))).toBe("observation");
    expect(autoTrainingFocus(s(38, 38, 35, true, 8))).toBe("fruit");
  });

  it("still answers something sensible when everything is at its ceiling", () => {
    expect(autoTrainingFocus(s(100, 100, 100, true))).toBe("armament");
    expect(autoTrainingFocus(s(38, 38, 38, true, 8))).toBe("armament");
  });
});

describe("resolveTrainingFocus", () => {
  it("honours an explicit choice even when it is not the lowest", () => {
    expect(resolveTrainingFocus("armament", s(42, 41, 38, true))).toBe("armament");
    expect(resolveTrainingFocus("observation", s(42, 41, 38, true))).toBe("observation");
  });

  it("falls back to auto when asked to train a fruit the character does not have", () => {
    expect(resolveTrainingFocus("fruit", s(30, 10))).toBe("observation");
  });

  it("auto delegates to autoTrainingFocus", () => {
    expect(resolveTrainingFocus("auto", s(42, 41, 38, true))).toBe("fruit");
  });
});

describe("ceilings", () => {
  it("knows each ceiling, level included", () => {
    expect(isTrainingMaxed("armament", s(100, 0))).toBe(true);
    expect(isTrainingMaxed("observation", s(100, 99))).toBe(false);
    expect(isTrainingMaxed("fruit", s(0, 0, 100, true))).toBe(true);
    expect(trainingCeiling("armament", s(0, 0, 0, false, 8))).toBe(38);
    expect(isTrainingMaxed("armament", s(38, 0, 0, false, 8))).toBe(true);
  });

  it("tells a level ceiling apart from the real maximum", () => {
    expect(isLevelCapped("armament", s(38, 0, 0, false, 8))).toBe(true);
    expect(isLevelCapped("armament", s(100, 0, 0, false, 30))).toBe(false);
  });
});

describe("trainingReadyInMs", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  it("is ready at once for someone who never trained", () => {
    expect(trainingReadyInMs(null, now)).toBe(0);
  });

  it("counts down the cooldown from the last session (ISO string or Date)", () => {
    expect(trainingReadyInMs("2026-10-04T11:50:00Z", now)).toBe(TRAINING_COOLDOWN_MS - 10 * 60 * 1000);
    expect(trainingReadyInMs(new Date("2026-10-04T11:00:00Z"), now)).toBe(0);
  });

  it("treats garbage as ready rather than blocking forever", () => {
    expect(trainingReadyInMs("not a date", now)).toBe(0);
  });
});
