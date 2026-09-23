import { describe, it, expect } from "vitest";
import { characterCondition, conditionLabel } from "./condition";

describe("characterCondition", () => {
  it("full health reads as ileso", () => {
    expect(characterCondition(100, 100)).toBe("ileso");
  });

  it("zero hp always reads as al borde de la muerte", () => {
    expect(characterCondition(0, 100)).toBe("al borde de la muerte");
  });

  it("is monotonic: never gets 'better' as hp decreases", () => {
    const order: string[] = ["al borde de la muerte", "malherido", "herido", "rasguñado", "ileso"];
    let lastIndex = -1;
    for (let hp = 0; hp <= 100; hp += 5) {
      const idx = order.indexOf(characterCondition(hp, 100));
      expect(idx).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = idx;
    }
  });

  it("handles a zero maxHp without dividing by zero into NaN", () => {
    expect(characterCondition(0, 0)).toBe("al borde de la muerte");
  });
});

describe("conditionLabel", () => {
  it("has a label for every condition", () => {
    expect(conditionLabel("ileso")).toBe("Ileso");
    expect(conditionLabel("al borde de la muerte")).toBe("Al borde de la muerte");
  });
});
