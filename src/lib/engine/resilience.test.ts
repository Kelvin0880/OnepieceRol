import { describe, it, expect } from "vitest";
import { levelResilience, estimateLevel, soakDamage, staminaCostAtLevel, applyFatigueToCombatant, npcStaminaAfterExchange, npcBaseEffort, RESILIENCE_FLOOR } from "./resilience";
import { attackOnce, resolveExchange, Combatant } from "./combat";
import { mulberry32 } from "./rng";

describe("levelResilience", () => {
  it("is neutral at level 1 or when the level is unknown", () => {
    expect(levelResilience(1)).toBe(1);
    expect(levelResilience(undefined)).toBe(1);
  });
  it("shrinks with level, monotonically, down to a floor", () => {
    expect(levelResilience(10)).toBeLessThan(levelResilience(2));
    expect(levelResilience(20)).toBeLessThan(levelResilience(10));
    expect(levelResilience(500)).toBe(RESILIENCE_FLOOR);
  });
});

describe("soakDamage / staminaCostAtLevel", () => {
  it("a level 20 takes less damage than a level 1 from the same blow", () => {
    expect(soakDamage(30, 20)).toBeLessThan(soakDamage(30, 1));
    expect(soakDamage(30, 1)).toBe(30);
  });
  it("a hit that lands always hurts a little, a miss does nothing", () => {
    expect(soakDamage(1, 100)).toBe(1);
    expect(soakDamage(0, 100)).toBe(0);
  });
  it("experienced fighters waste less stamina on the same action", () => {
    expect(staminaCostAtLevel(12, 20)).toBeLessThan(staminaCostAtLevel(12, 1));
    expect(staminaCostAtLevel(12, 1)).toBe(12);
    expect(staminaCostAtLevel(0, 20)).toBe(0);
    expect(staminaCostAtLevel(1, 99)).toBe(1);
  });
});

describe("estimateLevel", () => {
  it("weak enemies read as level 1 and formidable ones as much higher", () => {
    expect(estimateLevel(8, 4)).toBe(1);
    expect(estimateLevel(70, 42)).toBeGreaterThan(20);
  });
});

describe("combat integration", () => {
  const fighter = (over: Partial<Combatant> = {}): Combatant => ({ name: "X", hp: 100, maxHp: 100, atk: 60, def: 10, spd: 10, ...over });
  it("the same seeded attack deals less damage to a high-level defender", () => {
    let novice = 0;
    let veteran = 0;
    for (let seed = 1; seed <= 300; seed++) {
      novice += attackOnce(mulberry32(seed), fighter(), fighter({ level: 1 })).damage;
      veteran += attackOnce(mulberry32(seed), fighter(), fighter({ level: 30 })).damage;
    }
    expect(veteran).toBeLessThan(novice * 0.8);
  });
  it("without a level nothing changes (older callers keep their numbers)", () => {
    const a = resolveExchange(mulberry32(7), 1, fighter(), 100, fighter({ name: "Y" }), 100);
    const b = resolveExchange(mulberry32(7), 1, fighter(), 100, fighter({ name: "Y", level: 1 }), 100);
    expect(a.aHpAfter).toBe(b.aHpAfter);
    expect(a.bHpAfter).toBe(b.bHpAfter);
  });
});

describe("NPC fatigue", () => {
  it("a tired enemy hits and defends worse, an exhausted one much worse", () => {
    const c: Combatant = { name: "E", hp: 50, maxHp: 50, atk: 40, def: 20, spd: 20 };
    expect(applyFatigueToCombatant(c, 100).atk).toBe(40);
    expect(applyFatigueToCombatant(c, 20).atk).toBeLessThan(40);
    expect(applyFatigueToCombatant(c, 0).atk).toBeLessThan(applyFatigueToCombatant(c, 20).atk);
  });
  it("a veteran tires slower than a rookie under the same pressure", () => {
    const rookie = npcStaminaAfterExchange({ stamina: 100, level: 1, effort: 2, damageTaken: 30, maxHp: 100 });
    const veteran = npcStaminaAfterExchange({ stamina: 100, level: 25, effort: 2, damageTaken: 30, maxHp: 100 });
    expect(veteran).toBeGreaterThan(rookie);
  });
  it("never goes below zero and bosses push harder", () => {
    expect(npcStaminaAfterExchange({ stamina: 3, level: 1, effort: 3, damageTaken: 90, maxHp: 100 })).toBe(0);
    expect(npcBaseEffort(true)).toBeGreaterThan(npcBaseEffort(false));
  });
});
