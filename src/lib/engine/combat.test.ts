import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { runCombat, Combatant } from "./combat";

function fighter(overrides: Partial<Combatant> = {}): Combatant {
  return { name: "Luffy", hp: 50, maxHp: 50, atk: 20, def: 10, spd: 15, ...overrides };
}

describe("runCombat", () => {
  it("a vastly stronger player reliably beats a trivial enemy across many seeds", () => {
    let wins = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed);
      const player = fighter({ atk: 80, def: 60, hp: 200, maxHp: 200 });
      const enemy = fighter({ name: "Bandido", atk: 2, def: 1, hp: 20, maxHp: 20 });
      const result = runCombat(rng, player, enemy);
      if (result.victor === "player") wins++;
    }
    expect(wins / trials).toBeGreaterThan(0.9);
  });

  it("a vastly weaker player reliably loses to a boss across many seeds", () => {
    let losses = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed * 7 + 3);
      const player = fighter({ atk: 3, def: 2, hp: 15, maxHp: 15 });
      const enemy = fighter({ name: "Almirante", atk: 90, def: 70, hp: 300, maxHp: 300 });
      const result = runCombat(rng, player, enemy);
      if (result.victor === "enemy") losses++;
    }
    expect(losses / trials).toBeGreaterThan(0.9);
  });

  it("never lets hp drop below zero", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const result = runCombat(rng, fighter(), fighter({ name: "Rival" }));
      expect(result.playerHpLeft).toBeGreaterThanOrEqual(0);
      expect(result.enemyHpLeft).toBeGreaterThanOrEqual(0);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = runCombat(mulberry32(10), fighter(), fighter({ name: "Rival" }));
    const b = runCombat(mulberry32(10), fighter(), fighter({ name: "Rival" }));
    expect(a).toEqual(b);
  });

  it("produces a non-empty round log whenever combat actually happens", () => {
    const rng = mulberry32(3);
    const result = runCombat(rng, fighter(), fighter({ name: "Rival" }));
    expect(result.rounds.length).toBeGreaterThan(0);
    for (const round of result.rounds) {
      expect(round.damage).toBeGreaterThanOrEqual(0);
      expect(round.defenderHpAfter).toBeGreaterThanOrEqual(0);
    }
  });

  it("caps at MAX_ROUNDS worth of exchanges even in a stalemate", () => {
    const rng = mulberry32(1);
    // Equal stats, high HP -> unlikely to resolve in a couple of rounds.
    const result = runCombat(rng, fighter({ hp: 500, maxHp: 500 }), fighter({ name: "Rival", hp: 500, maxHp: 500 }));
    // 8 rounds * 2 attacks per round = 16 max log entries.
    expect(result.rounds.length).toBeLessThanOrEqual(16);
  });
});
