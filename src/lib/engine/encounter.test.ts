import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { assessThreat, attemptFlee } from "./encounter";
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

describe("attemptFlee", () => {
  it("a much faster player reliably escapes across many seeds", () => {
    let successes = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed);
      const player = fighter({ spd: 80 });
      const enemy = fighter({ spd: 5 });
      const result = attemptFlee(rng, player, enemy);
      if (result.success) successes++;
    }
    expect(successes / trials).toBeGreaterThan(0.85);
  });

  it("a much slower player rarely escapes cleanly", () => {
    let successes = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed);
      const player = fighter({ spd: 5 });
      const enemy = fighter({ spd: 80 });
      const result = attemptFlee(rng, player, enemy);
      if (result.success) successes++;
    }
    expect(successes / trials).toBeLessThan(0.3);
  });

  it("never reports damage on a successful flee", () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed);
      const result = attemptFlee(rng, fighter({ spd: 60 }), fighter({ spd: 10 }));
      if (result.success) expect(result.hpLoss).toBe(0);
    }
  });

  it("can always be attempted, even against a vastly superior foe", () => {
    let sawAnySuccess = false;
    for (let seed = 0; seed < 500; seed++) {
      const rng = mulberry32(seed);
      const result = attemptFlee(rng, fighter({ spd: 1 }), fighter({ spd: 99, atk: 99 }));
      if (result.success) sawAnySuccess = true;
    }
    expect(sawAnySuccess).toBe(true);
  });
});
