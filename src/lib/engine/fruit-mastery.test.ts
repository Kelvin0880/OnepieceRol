import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { fruitPhase, fruitPowerMultiplier, fruitStaminaMultiplier, masteryGainFromUse, trainFruitMastery, canAwaken, MASTERY_MAX } from "./fruit-mastery";

describe("fruit phases", () => {
  it("moves initial -> advanced with mastery, and awakened only via the flag", () => {
    expect(fruitPhase(0, false)).toBe("initial");
    expect(fruitPhase(34, false)).toBe("initial");
    expect(fruitPhase(35, false)).toBe("advanced");
    expect(fruitPhase(100, false)).toBe("advanced"); // maxed mastery alone is not the Awakening
    expect(fruitPhase(10, true)).toBe("awakened");
  });

  it("the initial phase is weaker and costlier than later phases", () => {
    expect(fruitPowerMultiplier("initial")).toBeLessThan(fruitPowerMultiplier("advanced"));
    expect(fruitStaminaMultiplier("initial")).toBeGreaterThan(fruitStaminaMultiplier("advanced"));
    expect(fruitStaminaMultiplier("awakened")).toBeLessThan(fruitStaminaMultiplier("advanced"));
  });
});

describe("mastery gain", () => {
  it("always gains at least 1 below the cap, and never exceeds it", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const m = Math.floor(rng() * 100);
      const g = masteryGainFromUse(m, 10);
      expect(g).toBeGreaterThanOrEqual(1);
      expect(m + g).toBeLessThanOrEqual(MASTERY_MAX);
    }
    expect(masteryGainFromUse(MASTERY_MAX, 10)).toBe(0);
    expect(trainFruitMastery(MASTERY_MAX, 10).gained).toBe(0);
  });
  it("training is steady, never random, and crossing a phase boundary doubles the session", () => {
    expect(trainFruitMastery(10, 20)).toEqual(trainFruitMastery(10, 20));
    const plain = trainFruitMastery(0, 10);
    expect(plain.breakthrough).toBe(false);
    const cross = trainFruitMastery(24, 10);
    expect(cross.breakthrough).toBe(true);
    expect(cross.gained).toBeGreaterThan(plain.gained);
  });
});

describe("canAwaken", () => {
  it("needs maxed mastery AND a breaking-point win", () => {
    expect(canAwaken(99, false, { enemyIsBoss: true, playerHpRatio: 0.1 })).toBe(false);
    expect(canAwaken(100, false, { enemyIsBoss: false, playerHpRatio: 0.9 })).toBe(false);
    expect(canAwaken(100, false, { enemyIsBoss: true, playerHpRatio: 0.9 })).toBe(true);
    expect(canAwaken(100, false, { enemyIsBoss: false, playerHpRatio: 0.2 })).toBe(true);
    expect(canAwaken(100, true, { enemyIsBoss: true, playerHpRatio: 0.1 })).toBe(false);
  });
});
