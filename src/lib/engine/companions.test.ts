import { describe, it, expect } from "vitest";
import { companionSheet, normalizeRole, companionMaxHp, recruitChance, rollRecruit, startingLoyalty, loyaltyRank, MAX_COMPANIONS } from "./companions";
import { mulberry32 } from "./rng";

describe("normalizeRole", () => {
  it("maps loose words onto a known archetype and keeps unknown roles", () => {
    expect(normalizeRole("un cocinero del bar")).toBe("Cocinero");
    expect(normalizeRole("Médica de a bordo")).toBe("Médico");
    expect(normalizeRole("arqueóloga")).toBe("Erudito");
    expect(normalizeRole("Domador de lobos")).toBe("Domador de lobos");
    expect(normalizeRole("")).toBe("Compañero");
    expect(normalizeRole(undefined)).toBe("Compañero");
  });
});

describe("companionSheet", () => {
  it("levels up with the captain: every stat grows with the owner level", () => {
    const low = companionSheet("Espadachín", 1, 50);
    const high = companionSheet("Espadachín", 20, 50);
    expect(high.level).toBe(20);
    expect(high.atk).toBeGreaterThan(low.atk);
    expect(high.def).toBeGreaterThan(low.def);
    expect(high.spd).toBeGreaterThan(low.spd);
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
  });
  it("roles are different: a swordsman hits harder than a doctor, a bodyguard is tougher than a musician", () => {
    expect(companionSheet("Espadachín", 10, 50).atk).toBeGreaterThan(companionSheet("Médico", 10, 50).atk);
    expect(companionSheet("Guardaespaldas", 10, 50).def).toBeGreaterThan(companionSheet("Músico", 10, 50).def);
    expect(companionMaxHp(10, "Guardaespaldas")).toBeGreaterThan(companionMaxHp(10, "Navegante"));
  });
  it("unlocks abilities at levels 1, 5 and 12", () => {
    expect(companionSheet("Cocinero", 1, 50).abilities).toHaveLength(1);
    expect(companionSheet("Cocinero", 5, 50).abilities).toHaveLength(2);
    expect(companionSheet("Cocinero", 12, 50).abilities).toHaveLength(3);
  });
  it("loyalty adds a little attack and sets the rank", () => {
    expect(companionSheet("Espadachín", 10, 100).atk).toBeGreaterThan(companionSheet("Espadachín", 10, 0).atk);
    expect(loyaltyRank(80)).toBe("Nakama");
    expect(loyaltyRank(40)).toBe("Compañero");
    expect(loyaltyRank(5)).toBe("Recién llegado");
  });
  it("never yields a zero or negative stat", () => {
    const s = companionSheet("Médico", 0, 0);
    expect(Math.min(s.atk, s.def, s.spd, s.maxHp)).toBeGreaterThan(0);
  });
});

describe("recruitment", () => {
  const base = { willpower: 20, intellect: 20, tacticModifier: 0, tier: "average" as const };
  it("a better pitch and stronger will raise the chance; a tougher target lowers it", () => {
    expect(recruitChance({ ...base, tacticModifier: 15 })).toBeGreaterThan(recruitChance(base));
    expect(recruitChance({ ...base, willpower: 80 })).toBeGreaterThan(recruitChance(base));
    expect(recruitChance({ ...base, tier: "elite" })).toBeLessThan(recruitChance(base));
  });
  it("is always a real gamble: bounded between 15% and 90%", () => {
    expect(recruitChance({ willpower: 0, intellect: 0, tacticModifier: -15, tier: "elite" })).toBe(15);
    expect(recruitChance({ willpower: 99, intellect: 99, tacticModifier: 20, tier: "weak" })).toBe(90);
  });
  it("rolls follow the chance over many seeds", () => {
    let wins = 0;
    for (let i = 1; i <= 400; i++) if (rollRecruit(mulberry32(i), 50)) wins++;
    expect(wins).toBeGreaterThan(140);
    expect(wins).toBeLessThan(260);
  });
  it("a convincing pitch buys a warmer start, within bounds", () => {
    expect(startingLoyalty(20)).toBeGreaterThan(startingLoyalty(0));
    expect(startingLoyalty(-50)).toBe(35);
    expect(startingLoyalty(50)).toBe(75);
  });
  it("caps the crew at a sensible size", () => expect(MAX_COMPANIONS).toBe(3));
});

import { parseCompanionProfile } from "./companions";

describe("commander profiles", () => {
  const profile = { epithet: "Corta-Tormentas", styleId: "santoryu", abilities: ["Corte Tormenta"], attrs: { strength: 140, agility: 100, durability: 100, willpower: 50, intellect: 50 } };
  it("replaces the role abilities with the hand-written ones and adds attributes on top", () => {
    const plain = companionSheet("Espadachín", 45, 90);
    const named = companionSheet("Espadachín", 45, 90, profile);
    expect(named.abilities[0]).toBe("Corte Tormenta");
    expect(named.abilities.length).toBeGreaterThan(1);
    expect(named.atk).toBeGreaterThan(plain.atk);
    expect(named.maxHp).toBeGreaterThan(plain.maxHp);
    expect(named.epithet).toBe("Corta-Tormentas");
    expect(named.styleId).toBe("santoryu");
  });
  it("without a profile nothing changes", () => {
    expect(companionSheet("Navegante", 10, 50, null)).toEqual(companionSheet("Navegante", 10, 50));
  });
  it("parses stored JSON defensively", () => {
    expect(parseCompanionProfile(JSON.stringify(profile))?.attrs?.strength).toBe(140);
    expect(parseCompanionProfile("not json")).toBeNull();
    expect(parseCompanionProfile(null)).toBeNull();
    expect(parseCompanionProfile(JSON.stringify({ attrs: { strength: "x", agility: 5000 } }))?.attrs).toEqual({ strength: 0, agility: 999, durability: 0, willpower: 0, intellect: 0 });
  });
});
