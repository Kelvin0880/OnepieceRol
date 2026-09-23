import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { runGroupBattle, BattleFighter, Matchup } from "./group-battle";
import { Combatant } from "./combat";

function fighter(id: string, overrides: Partial<Combatant> = {}): BattleFighter {
  return { id, combatant: { name: id, hp: 50, maxHp: 50, atk: 15, def: 10, spd: 10, ...overrides } };
}

describe("runGroupBattle", () => {
  it("throws when sides are unequal in size (matchups can't cover both)", () => {
    const sideA = [fighter("a1"), fighter("a2")];
    const sideB = [fighter("b1")];
    const matchups: Matchup[] = [{ aId: "a1", bId: "b1" }];
    expect(() => runGroupBattle(mulberry32(1), sideA, sideB, matchups)).toThrow();
  });

  it("throws when a matchup references an unknown fighter", () => {
    const sideA = [fighter("a1")];
    const sideB = [fighter("b1")];
    expect(() => runGroupBattle(mulberry32(1), sideA, sideB, [{ aId: "a1", bId: "ghost" }])).toThrow();
  });

  it("throws when a fighter appears in more than one matchup", () => {
    const sideA = [fighter("a1"), fighter("a2")];
    const sideB = [fighter("b1"), fighter("b2")];
    const matchups: Matchup[] = [
      { aId: "a1", bId: "b1" },
      { aId: "a1", bId: "b2" },
    ];
    expect(() => runGroupBattle(mulberry32(1), sideA, sideB, matchups)).toThrow();
  });

  it("throws on an empty side", () => {
    expect(() => runGroupBattle(mulberry32(1), [], [fighter("b1")], [])).toThrow();
  });

  it("is deterministic for a fixed seed", () => {
    const sideA = [fighter("a1"), fighter("a2")];
    const sideB = [fighter("b1"), fighter("b2")];
    const matchups: Matchup[] = [
      { aId: "a1", bId: "b1" },
      { aId: "a2", bId: "b2" },
    ];
    const r1 = runGroupBattle(mulberry32(42), sideA, sideB, matchups);
    const r2 = runGroupBattle(mulberry32(42), sideA, sideB, matchups);
    expect(r1).toEqual(r2);
  });

  it("a vastly stronger side wins the overall battle reliably across many seeds", () => {
    let wins = 0;
    const trials = 150;
    for (let seed = 0; seed < trials; seed++) {
      const sideA = [fighter("a1", { atk: 80, def: 60, hp: 200, maxHp: 200 }), fighter("a2", { atk: 80, def: 60, hp: 200, maxHp: 200 })];
      const sideB = [fighter("b1", { atk: 3, def: 2, hp: 20, maxHp: 20 }), fighter("b2", { atk: 3, def: 2, hp: 20, maxHp: 20 })];
      const matchups: Matchup[] = [
        { aId: "a1", bId: "b1" },
        { aId: "a2", bId: "b2" },
      ];
      const result = runGroupBattle(mulberry32(seed), sideA, sideB, matchups);
      if (result.victor === "a") wins++;
    }
    expect(wins / trials).toBeGreaterThan(0.9);
  });

  it("every duel outcome has non-negative hp on both sides", () => {
    for (let seed = 0; seed < 30; seed++) {
      const sideA = [fighter("a1"), fighter("a2"), fighter("a3")];
      const sideB = [fighter("b1"), fighter("b2"), fighter("b3")];
      const matchups: Matchup[] = [
        { aId: "a1", bId: "b1" },
        { aId: "a2", bId: "b2" },
        { aId: "a3", bId: "b3" },
      ];
      const result = runGroupBattle(mulberry32(seed), sideA, sideB, matchups);
      for (const d of result.duels) {
        expect(d.aHpLeft).toBeGreaterThanOrEqual(0);
        expect(d.bHpLeft).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("produces a duel outcome for every matchup submitted", () => {
    const sideA = [fighter("a1"), fighter("a2"), fighter("a3")];
    const sideB = [fighter("b1"), fighter("b2"), fighter("b3")];
    const matchups: Matchup[] = [
      { aId: "a1", bId: "b1" },
      { aId: "a2", bId: "b2" },
      { aId: "a3", bId: "b3" },
    ];
    const result = runGroupBattle(mulberry32(7), sideA, sideB, matchups);
    expect(result.duels).toHaveLength(3);
    expect(new Set(result.duels.map((d) => d.aId))).toEqual(new Set(["a1", "a2", "a3"]));
  });

  it("a free early winner can reinforce a struggling ally (assists occur in a lopsided setup)", () => {
    // a1 crushes a weak b1 quickly and should be free to help a2's tougher fight against b2.
    const sideA = [fighter("a1", { atk: 90, def: 50, hp: 100, maxHp: 100 }), fighter("a2", { atk: 12, def: 10, hp: 40, maxHp: 40 })];
    const sideB = [fighter("b1", { atk: 2, def: 1, hp: 15, maxHp: 15 }), fighter("b2", { atk: 14, def: 12, hp: 60, maxHp: 60 })];
    const matchups: Matchup[] = [
      { aId: "a1", bId: "b1" },
      { aId: "a2", bId: "b2" },
    ];

    let sawAssist = false;
    for (let seed = 0; seed < 100 && !sawAssist; seed++) {
      const result = runGroupBattle(mulberry32(seed), sideA, sideB, matchups);
      if (result.assists.some((a) => a.assisterId === "a1" && a.assistedId === "a2")) sawAssist = true;
    }
    expect(sawAssist).toBe(true);
  });

  it("never assigns more than the assist cap to a single duel side", () => {
    const sideA = Array.from({ length: 5 }, (_, i) => fighter(`a${i}`, { atk: 90, def: 50, hp: 100, maxHp: 100 }));
    const sideB = [
      ...Array.from({ length: 4 }, (_, i) => fighter(`b${i}`, { atk: 1, def: 1, hp: 10, maxHp: 10 })),
      fighter("bTank", { atk: 20, def: 20, hp: 500, maxHp: 500 }),
    ];
    const matchups: Matchup[] = [
      { aId: "a0", bId: "b0" },
      { aId: "a1", bId: "b1" },
      { aId: "a2", bId: "b2" },
      { aId: "a3", bId: "b3" },
      { aId: "a4", bId: "bTank" },
    ];
    const result = runGroupBattle(mulberry32(3), sideA, sideB, matchups);
    const assistsOnA4Duel = result.assists.filter((a) => a.assistedId === "a4").length;
    expect(assistsOnA4Duel).toBeLessThanOrEqual(3);
  });
});
