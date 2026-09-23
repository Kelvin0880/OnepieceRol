import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { resolveTechnique, hakiGrowthFromUse, TechniqueContext } from "./techniques";

const ctx: TechniqueContext = {
  armamentHaki: 50,
  observationHaki: 40,
  conquerorsHaki: false,
  fruitBase: { atk: 10, def: 4, spd: 2 },
  fruitPhase: "advanced",
  stamina: 100,
};

describe("resolveTechnique", () => {
  it("armament haki adds atk/def scaled by the trained level and costs stamina", () => {
    const e = resolveTechnique("armament", ctx);
    expect(e.used).toBe("armament");
    expect(e.atk).toBe(10);
    expect(e.def).toBe(8);
    expect(e.staminaCost).toBeGreaterThan(4);
  });

  it("downgrades to basic combat when the character lacks that ability", () => {
    expect(resolveTechnique("armament", { ...ctx, armamentHaki: 0 })).toMatchObject({ used: "none", downgraded: true });
    expect(resolveTechnique("conqueror", ctx)).toMatchObject({ used: "none", downgraded: true });
    expect(resolveTechnique("fruit", { ...ctx, fruitBase: null })).toMatchObject({ used: "none", downgraded: true });
  });

  it("downgrades when there is not enough stamina, with the reason for the narrator", () => {
    const e = resolveTechnique("armament", { ...ctx, stamina: 3 });
    expect(e.used).toBe("none");
    expect(e.downgradeReason).toMatch(/aliento/);
  });

  it("a fruit technique is cheaper and stronger in later phases", () => {
    const initial = resolveTechnique("fruit", { ...ctx, fruitPhase: "initial" });
    const advanced = resolveTechnique("fruit", ctx);
    expect(initial.staminaCost).toBeGreaterThan(advanced.staminaCost);
    expect(initial.atk).toBeLessThan(advanced.atk);
  });

  it("plain combat is always available and cheap", () => {
    const e = resolveTechnique("none", { ...ctx, stamina: 4 });
    expect(e.downgraded).toBe(false);
    expect(e.staminaCost).toBe(4);
  });
});

describe("hakiGrowthFromUse", () => {
  it("only haki techniques grow, and never past 100", () => {
    const rng = mulberry32(9);
    expect(hakiGrowthFromUse(rng, "fruit", 10)).toBe(0);
    expect(hakiGrowthFromUse(rng, "armament", 100)).toBe(0);
    let grew = 0;
    for (let i = 0; i < 300; i++) grew += hakiGrowthFromUse(rng, "observation", 10);
    expect(grew).toBeGreaterThan(0);
  });
});
