import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { assessThreat } from "./encounter";
import { Combatant } from "./combat";

function fighter(overrides: Partial<Combatant> = {}): Combatant {
  return { name: "X", hp: 50, maxHp: 50, atk: 10, def: 10, spd: 10, ...overrides };
}

describe("assessThreat", () => {
  it("reads a much weaker enemy as 'weaker'", () => {
    const player = fighter({ atk: 50, def: 50, spd: 50 });
    const enemy = fighter({ atk: 2, def: 2, spd: 2 });
    expect(assessThreat(player, enemy)).toBe("weaker");
  });

  it("reads a much stronger enemy as 'superior'", () => {
    const player = fighter({ atk: 2, def: 2, spd: 2 });
    const enemy = fighter({ atk: 50, def: 50, spd: 50 });
    expect(assessThreat(player, enemy)).toBe("superior");
  });

  it("reads roughly matched combatants as 'even'", () => {
    const player = fighter({ atk: 20, def: 20, spd: 20 });
    const enemy = fighter({ atk: 22, def: 18, spd: 20 });
    expect(assessThreat(player, enemy)).toBe("even");
  });
});

