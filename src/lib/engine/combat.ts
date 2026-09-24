import { Rng } from "./rng";
import { skillCheck } from "./checks";
import { soakDamage } from "./resilience";

export interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** Experience: higher levels soak more damage and tire slower (engine/resilience.ts). Absent = no adjustment. */
  level?: number;
  /** Fraction (0-0.5) of the defender's defence this attacker ignores: vibration, claw and internal-shock styles. */
  pierce?: number;
}

export interface CombatRoundLog {
  round: number;
  attacker: string;
  defender: string;
  roll: number;
  outcome: "critical_fail" | "fail" | "success" | "critical_success";
  damage: number;
  defenderHpAfter: number;
}

export interface CombatResult {
  victor: "player" | "enemy" | "draw";
  rounds: CombatRoundLog[];
  playerHpLeft: number;
  enemyHpLeft: number;
}

export const MAX_ROUNDS = 60; // only a stalemate guard: stamina and HP end fights long before this

export function attackOnce(rng: Rng, attacker: Combatant, defender: Combatant): { damage: number; outcome: CombatRoundLog["outcome"]; roll: number } {
  const defenderDifficulty = 40 + Math.round(defender.def * (1 - Math.max(0, Math.min(0.5, attacker.pierce ?? 0))));
  const check = skillCheck(rng, attacker.atk, defenderDifficulty);

  let damage = 0;
  if (check.outcome === "critical_success") {
    damage = Math.round(attacker.atk * 0.6 + 12);
  } else if (check.outcome === "success") {
    damage = Math.round(attacker.atk * 0.3 + Math.max(0, check.margin) * 0.15);
  }

  return { damage: soakDamage(damage, defender.level), outcome: check.outcome, roll: check.roll };
}

/**
 * One full exchange between two combatants: whoever is faster swings
 * first, then the other replies if still standing. Shared by `runCombat`
 * (which loops this to a full duel) and the group-battle simulator (which
 * runs one exchange per wave across many simultaneous duels so a fighter
 * who finishes early can reinforce an ally mid-wave).
 */
export function resolveExchange(
  rng: Rng,
  round: number,
  a: Combatant,
  aHp: number,
  b: Combatant,
  bHp: number
): { aHpAfter: number; bHpAfter: number; log: CombatRoundLog[] } {
  const log: CombatRoundLog[] = [];
  let hpA = aHp;
  let hpB = bHp;

  const aFirst = a.spd >= b.spd;
  const order: Array<["a" | "b", Combatant, Combatant]> = aFirst
    ? [
        ["a", a, b],
        ["b", b, a],
      ]
    : [
        ["b", b, a],
        ["a", a, b],
      ];

  for (const [side, attacker, defender] of order) {
    if (hpA <= 0 || hpB <= 0) break;
    const { damage, outcome, roll } = attackOnce(rng, attacker, defender);
    if (side === "a") hpB = Math.max(0, hpB - damage);
    else hpA = Math.max(0, hpA - damage);

    log.push({
      round,
      attacker: attacker.name,
      defender: defender.name,
      roll,
      outcome,
      damage,
      defenderHpAfter: side === "a" ? hpB : hpA,
    });
  }

  return { aHpAfter: hpA, bHpAfter: hpB, log };
}

/**
 * Turn order alternates strictly player-then-enemy (speed only breaks ties
 * on the very first round) so fights stay legible in a text log instead of
 * simulating a full initiative tracker.
 */
export function runCombat(rng: Rng, player: Combatant, enemy: Combatant): CombatResult {
  let playerHp = player.hp;
  let enemyHp = enemy.hp;
  const rounds: CombatRoundLog[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const { aHpAfter, bHpAfter, log } = resolveExchange(rng, round, player, playerHp, enemy, enemyHp);
    playerHp = aHpAfter;
    enemyHp = bHpAfter;
    rounds.push(...log);
    if (playerHp <= 0 || enemyHp <= 0) break;
  }

  let victor: CombatResult["victor"];
  if (playerHp <= 0 && enemyHp <= 0) victor = "draw";
  else if (enemyHp <= 0) victor = "player";
  else if (playerHp <= 0) victor = "enemy";
  else victor = enemyHp < playerHp ? "player" : "draw"; // ran out of rounds: whoever is healthier wins the exchange

  return { victor, rounds, playerHpLeft: playerHp, enemyHpLeft: enemyHp };
}
