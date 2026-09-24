import { describe, it, expect } from "vitest";
import { regenStamina, fatigueLevel, spendStamina, restStamina, FATIGUE_MULTIPLIERS, STAMINA_REGEN_PER_MINUTE } from "./stamina";

describe("stamina", () => {
  it("regenerates over real time and never exceeds the max", () => {
    expect(regenStamina(10, 100, 10 * 60_000)).toBe(10 + 10 * STAMINA_REGEN_PER_MINUTE);
    expect(regenStamina(95, 100, 60 * 60_000)).toBe(100);
    expect(regenStamina(40, 100, 0)).toBe(40);
  });

  it("classifies fatigue by fraction of max", () => {
    expect(fatigueLevel(100, 100)).toBe("fresh");
    expect(fatigueLevel(25, 100)).toBe("tired");
    expect(fatigueLevel(0, 100)).toBe("exhausted");
  });

  it("fatigue only ever weakens a fighter, exhaustion more than tiredness", () => {
    expect(FATIGUE_MULTIPLIERS.fresh.atk).toBe(1);
    expect(FATIGUE_MULTIPLIERS.tired.atk).toBeLessThan(1);
    expect(FATIGUE_MULTIPLIERS.exhausted.atk).toBeLessThan(FATIGUE_MULTIPLIERS.tired.atk);
  });

  it("spending clamps at zero and resting recovers a big chunk up to the max", () => {
    expect(spendStamina(5, 20)).toBe(0);
    expect(restStamina(10, 100)).toBe(70);
    expect(restStamina(90, 100)).toBe(100);
  });
});

import { clampEffort, effortStaminaCost, staminaLossFromDamage, overexertionHpLoss, EFFORT_STAMINA_COST } from "./stamina";

describe("effort and combat fatigue", () => {
  it("clamps any classifier output into a valid tier and defaults garbage to an ordinary effort", () => {
    expect(clampEffort(2)).toBe(2);
    expect(clampEffort(9)).toBe(3);
    expect(clampEffort(-4)).toBe(0);
    expect(clampEffort("x")).toBe(1);
    expect(clampEffort(undefined)).toBe(1);
  });
  it("costs grow with effort and scale with max stamina, never below 1", () => {
    expect(effortStaminaCost(3, 100)).toBe(EFFORT_STAMINA_COST[3]);
    expect(effortStaminaCost(3, 200)).toBe(EFFORT_STAMINA_COST[3] * 2);
    expect(effortStaminaCost(0, 10)).toBe(1);
    expect(effortStaminaCost(3, 100)).toBeGreaterThan(effortStaminaCost(1, 100));
  });
  it("taking damage tires proportionally to max HP", () => {
    expect(staminaLossFromDamage(0, 100)).toBe(0);
    expect(staminaLossFromDamage(25, 100)).toBe(10);
    expect(staminaLossFromDamage(50, 100)).toBeGreaterThan(staminaLossFromDamage(10, 100));
  });
  it("overexertion only bites demanding moves on an empty tank, and never kills", () => {
    expect(overexertionHpLoss(1, 0, 3, 100, 50)).toBe(0);
    expect(overexertionHpLoss(3, 50, 12, 100, 50)).toBe(0);
    expect(overexertionHpLoss(3, 2, 12, 100, 50)).toBe(9);
    expect(overexertionHpLoss(3, 0, 12, 100, 4)).toBe(3);
    expect(overexertionHpLoss(3, 0, 12, 100, 1)).toBe(0);
  });
});
