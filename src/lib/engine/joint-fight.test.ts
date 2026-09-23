import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { resolveJointRound, scaleEnemyForGroup, enemyAttacksThisRound, MAX_JOINT_ROUNDS, JointFighter } from "./joint-fight";

const mk = (id: string, atk = 25): JointFighter => ({ id, hp: 60, combatant: { name: id, hp: 60, maxHp: 60, atk, def: 10, spd: 10 } });
const boss = { name: "Jefe", hp: 100, maxHp: 100, atk: 30, def: 15, spd: 9 };

describe("scaleEnemyForGroup", () => {
  it("leaves a solo enemy untouched and grows HP/atk with headcount", () => {
    expect(scaleEnemyForGroup(boss, 1)).toEqual(boss);
    const four = scaleEnemyForGroup(boss, 4);
    expect(four.maxHp).toBeGreaterThan(boss.maxHp * 2.5);
    expect(four.atk).toBeGreaterThan(boss.atk);
    expect(four.hp).toBe(four.maxHp);
  });
});

describe("enemyAttacksThisRound", () => {
  it("scales 1..3 with standing fighters", () => {
    expect([1, 2, 3, 5, 9].map((n) => enemyAttacksThisRound(n))).toEqual([1, 1, 2, 3, 3]);
  });
});

describe("resolveJointRound", () => {
  it("every standing fighter attacks and the log stays consistent", () => {
    const r = resolveJointRound(mulberry32(1), 1, [mk("a"), mk("b"), mk("c")], boss, 300);
    expect(r.log.filter((l) => l.defender === "Jefe").length).toBe(3);
    expect(r.log.filter((l) => l.attacker === "Jefe").length).toBe(2);
    expect(r.enemyHpAfter).toBeLessThanOrEqual(300);
  });

  it("a downed fighter no longer acts or gets targeted in later rounds", () => {
    const down: JointFighter = { ...mk("z"), hp: 0 };
    const r = resolveJointRound(mulberry32(3), 1, [mk("a"), down], boss, 100);
    expect(r.log.some((l) => l.attacker === "z" || l.defender === "z")).toBe(false);
    expect(r.fighters.find((f) => f.id === "z")!.down).toBe(true);
  });

  it("always terminates with a victory or defeat inside MAX_JOINT_ROUNDS", () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = mulberry32(seed);
      let fighters = [mk("a"), mk("b"), mk("c")];
      const scaled = scaleEnemyForGroup(boss, 3);
      let eHp = scaled.hp;
      let outcome: string | null = null;
      for (let round = 1; round <= MAX_JOINT_ROUNDS && !outcome; round++) {
        const r = resolveJointRound(rng, round, fighters, scaled, eHp);
        fighters = fighters.map((f) => ({ ...f, hp: r.fighters.find((x) => x.id === f.id)!.hpAfter }));
        eHp = r.enemyHpAfter;
        outcome = r.outcome;
        if (!r.finished) expect(r.outcome).toBeNull();
      }
      expect(outcome === "victory" || outcome === "defeat").toBe(true);
    }
  });

  it("a strong group beats a weak enemy and a weak group loses to a strong one", () => {
    const wins = (atk: number, foe: typeof boss) => {
      let w = 0;
      for (let seed = 0; seed < 40; seed++) {
        const rng = mulberry32(seed);
        let fs = [mk("a", atk), mk("b", atk)];
        let e = foe.hp;
        let out: string | null = null;
        for (let round = 1; round <= MAX_JOINT_ROUNDS && !out; round++) {
          const r = resolveJointRound(rng, round, fs, foe, e);
          fs = fs.map((f) => ({ ...f, hp: r.fighters.find((x) => x.id === f.id)!.hpAfter }));
          e = r.enemyHpAfter;
          out = r.outcome;
        }
        if (out === "victory") w++;
      }
      return w;
    };
    expect(wins(60, { ...boss, hp: 60, maxHp: 60, atk: 10, def: 5 })).toBeGreaterThan(35);
    expect(wins(5, { ...boss, hp: 900, maxHp: 900, atk: 90, def: 60 })).toBeLessThan(5);
  });
});

describe("raid-sized fights", () => {
  it("a higher enemy-attack ceiling lets a boss answer a large group with more swings", () => {
    expect(enemyAttacksThisRound(20)).toBe(3);
    expect(enemyAttacksThisRound(20, 6)).toBe(6);
    expect(enemyAttacksThisRound(3, 6)).toBe(2);
    const many = Array.from({ length: 12 }, (_, i) => mk(`p${i}`));
    const r = resolveJointRound(mulberry32(5), 1, many, boss, 5000, { maxEnemyAttacks: 6 });
    expect(r.log.filter((l) => l.attacker === "Jefe").length).toBe(6);
    const capped = resolveJointRound(mulberry32(5), 1, many, boss, 5000);
    expect(capped.log.filter((l) => l.attacker === "Jefe").length).toBe(3);
  });
});
