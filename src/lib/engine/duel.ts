import { Rng } from "./rng";
import { Combatant, CombatRoundLog, resolveExchange } from "./combat";

export const MAX_DUEL_ROUNDS = 60;

export interface DuelRoundResult {
  aHpAfter: number;
  bHpAfter: number;
  log: CombatRoundLog[];
  finished: boolean;
  /** "a" | "b" once finished; null while it goes on. Never a draw — see below. */
  winner: "a" | "b" | null;
}

/**
 * One simultaneous round of a 1-vs-1 duel: both fighters' moves (already
 * folded into their Combatants by the caller) are resolved by the engine in
 * one exchange, faster fighter first. A duel ends on a knockout, or after
 * MAX_DUEL_ROUNDS with the healthier-by-ratio fighter winning (an exact tie
 * goes to the faster one) — a duel always produces a winner, the AI only
 * narrates it.
 */
export function resolveDuelRound(rng: Rng, round: number, a: Combatant, aHp: number, b: Combatant, bHp: number): DuelRoundResult {
  const { aHpAfter, bHpAfter, log } = resolveExchange(rng, round, a, aHp, b, bHp);
  if (aHpAfter <= 0 && bHpAfter <= 0) return { aHpAfter, bHpAfter, log, finished: true, winner: a.spd >= b.spd ? "a" : "b" };
  if (bHpAfter <= 0) return { aHpAfter, bHpAfter, log, finished: true, winner: "a" };
  if (aHpAfter <= 0) return { aHpAfter, bHpAfter, log, finished: true, winner: "b" };
  if (round >= MAX_DUEL_ROUNDS) {
    const ratioA = aHpAfter / a.maxHp;
    const ratioB = bHpAfter / b.maxHp;
    const winner: "a" | "b" = ratioA > ratioB ? "a" : ratioB > ratioA ? "b" : a.spd >= b.spd ? "a" : "b";
    return { aHpAfter, bHpAfter, log, finished: true, winner };
  }
  return { aHpAfter, bHpAfter, log, finished: false, winner: null };
}
