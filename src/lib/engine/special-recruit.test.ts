import { describe, expect, it } from "vitest";
import { parseSpecialRecruit, recruitConditionProblem, SpecialRecruitDef, validateSpecialRecruit } from "./special-recruit";

const who = { level: 10, faction: "PIRATE", bounty: 5_000_000, notoriety: 0, berries: 50_000, itemIds: ["banquete"] };

describe("recruitConditionProblem", () => {
  it("passes when everything asked is met", () => {
    expect(recruitConditionProblem({ minLevel: 10, factions: ["PIRATE"], minBounty: 1_000_000, item: "banquete", berries: 50_000 }, who)).toBeNull();
  });
  it("names the first thing missing, in Spanish, without exact numbers for bounty or notoriety", () => {
    expect(recruitConditionProblem({ minLevel: 20 }, who)).toMatch(/experiencia/);
    expect(recruitConditionProblem({ factions: ["MARINE"] }, who)).toMatch(/bandera/);
    expect(recruitConditionProblem({ minBounty: 90_000_000 }, who)).toMatch(/carteles/);
    expect(recruitConditionProblem({ minBounty: 90_000_000 }, who)).not.toMatch(/90/);
    expect(recruitConditionProblem({ item: "perla" }, who)).toMatch(/aún no llevas/);
    expect(recruitConditionProblem({ berries: 900_000 }, who)).toMatch(/900/);
  });
  it("bounty applies to pirates and notoriety to everyone else", () => {
    expect(recruitConditionProblem({ minBounty: 90_000_000 }, { ...who, faction: "MARINE" })).toBeNull();
    expect(recruitConditionProblem({ minNotoriety: 500 }, { ...who, faction: "MARINE", notoriety: 100 })).toMatch(/entre los tuyos/);
    expect(recruitConditionProblem({ minNotoriety: 500 }, who)).toBeNull();
  });
});

const def: SpecialRecruitDef = {
  role: "Cocinero",
  epithet: "El del cuchillo silencioso",
  abilities: ["Patadas de cocina", "Cuchillo de deshuesar"],
  attrs: { strength: 20, agility: 25, durability: 20, willpower: 30, intellect: 25 },
  lore: "Fue cocinero de un barco que se hundió con su capitán; desde entonces no confía en nadie que no sepa comer sin prisa, y solo sigue a quien le demuestre que el mar se cruza con la tripulación bien alimentada.",
  hint: "Solo sigue a quien ya ha demostrado saber cuidar de los suyos.",
  condition: { minLevel: 8 },
};
const cat = { itemIds: new Set(["banquete"]), styleIds: new Set(["black_leg"]) };

describe("validateSpecialRecruit", () => {
  it("accepts a good recruit", () => {
    expect(validateSpecialRecruit("Sanji", def, cat)).toEqual([]);
  });
  it("rejects every kind of broken recruit", () => {
    const bad = (p: Partial<SpecialRecruitDef>) => validateSpecialRecruit("X", { ...def, ...p }, cat).join();
    expect(bad({ lore: "corto" })).toMatch(/lore/);
    expect(bad({ hint: "Pide 5000000 berries" })).toMatch(/hint/);
    expect(bad({ abilities: ["una"] })).toMatch(/abilities/);
    expect(bad({ styleId: "nope" })).toMatch(/style/);
    expect(bad({ attrs: { strength: 99, agility: 1, durability: 1, willpower: 1, intellect: 1 } })).toMatch(/attributes/);
    expect(bad({ condition: { item: "nope" } })).toMatch(/unknown item/);
    expect(bad({ condition: {} })).toMatch(/no condition/);
    expect(bad({ condition: { berries: 5 } })).toMatch(/berries/);
  });
});

describe("parseSpecialRecruit", () => {
  it("round-trips and never trusts junk", () => {
    expect(parseSpecialRecruit(JSON.stringify(def))?.role).toBe("Cocinero");
    expect(parseSpecialRecruit("{oops")).toBeNull();
    expect(parseSpecialRecruit(null)).toBeNull();
    expect(parseSpecialRecruit(JSON.stringify({ role: "x" }))).toBeNull();
  });
});
