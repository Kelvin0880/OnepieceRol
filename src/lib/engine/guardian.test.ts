import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { isActorHome, actorCombatStats, guardianMeeting, stealthDifficulty, stealthModifier, stealthResultFrom } from "./guardian";

describe("isActorHome", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("is home when free or the busy window already ended", () => {
    expect(isActorHome(null, now)).toBe(true);
    expect(isActorHome(new Date("2026-01-01T11:00:00Z"), now)).toBe(true);
  });
  it("is away while busy on world business", () => {
    expect(isActorHome(new Date("2026-01-01T13:00:00Z"), now)).toBe(false);
  });
});

describe("actorCombatStats", () => {
  it("scales with power and clamps out-of-range values", () => {
    expect(actorCombatStats(100).hp).toBeGreaterThan(actorCombatStats(50).hp);
    expect(actorCombatStats(500)).toEqual(actorCombatStats(100));
    expect(actorCombatStats(-5)).toEqual(actorCombatStats(1));
  });
  it("makes a Yonko-tier holder much tougher than the subordinate that stands in (320 hp / 78 atk)", () => {
    const s = actorCombatStats(95);
    expect(s.hp).toBeGreaterThan(320 * 2);
    expect(s.atk).toBeGreaterThan(78 * 1.5);
  });
});

describe("stealth", () => {
  const base = { islandDanger: 10, actorHome: false, poneglyphHeat: 0, grudgeHeat: 0 };
  it("is harder with the holder home, while hunted, and against a grudge", () => {
    const d0 = stealthDifficulty(base);
    expect(stealthDifficulty({ ...base, actorHome: true })).toBeGreaterThan(d0);
    expect(stealthDifficulty({ ...base, poneglyphHeat: 120 })).toBeGreaterThan(d0);
    expect(stealthDifficulty({ ...base, grudgeHeat: 100 })).toBeGreaterThan(d0);
  });
  it("modifier rewards agility, wits, observation haki and a clever approach", () => {
    const m = { agility: 40, intellect: 30, observationHaki: 20, level: 10, tacticModifier: 0 };
    expect(stealthModifier({ ...m, tacticModifier: 15 })).toBeGreaterThan(stealthModifier(m));
    expect(stealthModifier({ ...m, agility: 80 })).toBeGreaterThan(stealthModifier(m));
  });
});

describe("guardianMeeting", () => {
  it("the holder receives visitors in person when home and leaves a subordinate when away", () => {
    expect(guardianMeeting(true)).toBe("actor");
    expect(guardianMeeting(false)).toBe("subordinate");
  });
});

describe("stealthResultFrom", () => {
  it("maps the judge's outcome onto the four stealth results", () => {
    expect(stealthResultFrom("critical_success")).toBe("clean");
    expect(stealthResultFrom("success")).toBe("noticed");
    expect(stealthResultFrom("fail")).toBe("spotted");
    expect(stealthResultFrom("critical_fail")).toBe("caught");
  });
});
