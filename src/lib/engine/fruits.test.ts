import { describe, it, expect } from "vitest";
import { parseFruitEffects, serializeFruitEffects, fruitCombatModifier, FruitEffects } from "./fruits";

describe("serializeFruitEffects / parseFruitEffects", () => {
  it("round-trips without data loss", () => {
    const effects: FruitEffects = {
      category: "offensive",
      element: "fuego",
      atk: 15,
      def: 3,
      spd: 5,
      awakened: { atk: 25, note: "El mar entero arde" },
    };
    const json = serializeFruitEffects(effects);
    const parsed = parseFruitEffects(json);
    expect(parsed).toEqual(effects);
  });
});

describe("fruitCombatModifier", () => {
  it("returns all zeros when there is no fruit", () => {
    expect(fruitCombatModifier(null, false)).toEqual({ atk: 0, def: 0, spd: 0 });
  });

  it("applies only base effects when not awakened", () => {
    const effects: FruitEffects = { category: "offensive", atk: 10, def: 2, spd: 1, awakened: { atk: 999 } };
    expect(fruitCombatModifier(effects, false)).toEqual({ atk: 10, def: 2, spd: 1 });
  });

  it("adds awakened bonuses on top of base effects when awakened", () => {
    const effects: FruitEffects = { category: "offensive", atk: 10, def: 2, spd: 1, awakened: { atk: 20, def: 5 } };
    expect(fruitCombatModifier(effects, true)).toEqual({ atk: 30, def: 7, spd: 1 });
  });

  it("treats missing numeric fields as zero", () => {
    const effects: FruitEffects = { category: "utility" };
    expect(fruitCombatModifier(effects, true)).toEqual({ atk: 0, def: 0, spd: 0 });
  });
});
