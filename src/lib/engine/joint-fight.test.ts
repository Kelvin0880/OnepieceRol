import { describe, it, expect } from "vitest";
import { scaleEnemyForGroup, enemyAttacksThisRound } from "./joint-fight";

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

describe("raid-sized fights", () => {
  it("a higher enemy-attack ceiling lets a boss answer a large group with more swings", () => {
    expect(enemyAttacksThisRound(20)).toBe(3);
    expect(enemyAttacksThisRound(20, 6)).toBe(6);
    expect(enemyAttacksThisRound(3, 6)).toBe(2);
  });
});
