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
