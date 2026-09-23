import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { resolveDuelRound, MAX_DUEL_ROUNDS } from "./duel";

const a = { name: "A", hp: 50, maxHp: 50, atk: 25, def: 10, spd: 12 };
const b = { name: "B", hp: 50, maxHp: 50, atk: 25, def: 10, spd: 8 };

describe("resolveDuelRound", () => {
  it("always ends with exactly one winner, whatever the seed", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = mulberry32(seed);
      let ahp = a.maxHp;
      let bhp = b.maxHp;
      let winner: "a" | "b" | null = null;
      for (let round = 1; round <= MAX_DUEL_ROUNDS && !winner; round++) {
        const r = resolveDuelRound(rng, round, a, ahp, b, bhp);
        ahp = r.aHpAfter;
        bhp = r.bHpAfter;
        winner = r.winner;
        if (!r.finished) expect(r.winner).toBeNull();
      }
      expect(winner === "a" || winner === "b").toBe(true);
    }
  });

  it("at the round cap the healthier fighter wins", () => {
    const r = resolveDuelRound(mulberry32(1), MAX_DUEL_ROUNDS, { ...a, atk: 0 }, 40, { ...b, atk: 0 }, 10);
    expect(r.finished).toBe(true);
    expect(r.winner).toBe("a");
  });
});
