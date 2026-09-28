import { describe, expect, it } from "vitest";
import { logiaImmuneTo } from "./logia-guard";
import { applyVerdict } from "./referee";

const rookie = { armamentHaki: 0, observationHaki: 0, conqueror: false, abilities: ["puñetazos"] };

describe("logiaImmuneTo", () => {
  it("a plain brawler with no Haki, fruit or seastone cannot hurt a Logia", () => {
    expect(logiaImmuneTo(rookie)).toBe(true);
    expect(logiaImmuneTo({ ...rookie, weapon: "Espada de acero" })).toBe(true);
  });
  it("Armament Haki or Conqueror's Haki gets through", () => {
    expect(logiaImmuneTo({ ...rookie, armamentHaki: 1 })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, conqueror: true })).toBe(false);
  });
  it("any devil fruit gets through: same element cannot be ruled out, so the guard stays out of the way", () => {
    expect(logiaImmuneTo({ ...rookie, fruit: { name: "Gomu Gomu no Mi", phase: "initial" } })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, secondFruit: { name: "Gura Gura no Mi", phase: "initial" } })).toBe(false);
  });
  it("seastone gets through, in the weapon or in a signature move, in Spanish or English", () => {
    expect(logiaImmuneTo({ ...rookie, weapon: "Porra de Kairoseki" })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, abilities: ["red de piedra marina"] })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, abilities: ["seastone cuffs"] })).toBe(false);
  });
});

describe("applyVerdict hpImmune", () => {
  const verdict = { narration: "x".repeat(60), changes: [{ name: "Shiro", hp: 4, stamina: 6 }] };
  it("takes no life but still tires the fighter", () => {
    const [s] = applyVerdict(verdict, [{ name: "Shiro", hp: 100, maxHp: 100, stamina: 80, hpImmune: true }]);
    expect(s).toMatchObject({ hpLoss: 0, hpAfter: 100, staminaLoss: 6, staminaAfter: 74 });
  });
  it("also ignores a declared defeat", () => {
    const [s] = applyVerdict({ ...verdict, defeated: ["Shiro"] }, [{ name: "Shiro", hp: 30, maxHp: 100, hpImmune: true }]);
    expect(s.hpLoss).toBe(0);
  });
  it("leaves everyone else untouched", () => {
    const [s] = applyVerdict(verdict, [{ name: "Shiro", hp: 100, maxHp: 100, stamina: 80 }]);
    expect(s.hpLoss).toBe(4);
  });
});
