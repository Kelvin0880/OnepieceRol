import { Rng } from "./rng";
import { Combatant, CombatRoundLog, attackOnce } from "./combat";

export const MAX_JOINT_ROUNDS = 12;
export const MAX_ENEMY_ATTACKS_PER_ROUND = 3;

export interface JointFighter {
  id: string;
  combatant: Combatant;
  hp: number;
}

export interface JointFighterResult {
  id: string;
  hpAfter: number;
  down: boolean;
}

export interface JointRoundResult {
  fighters: JointFighterResult[];
  enemyHpAfter: number;
  log: CombatRoundLog[];
  finished: boolean;
  outcome: "victory" | "defeat" | null;
}

/** A boss facing several people must not fold in one exchange: HP and punch scale with headcount. */
export function scaleEnemyForGroup(enemy: Combatant, headcount: number): Combatant {
  const extra = Math.max(0, headcount - 1);
  const hp = Math.round(enemy.maxHp * (1 + 0.75 * extra));
  return { ...enemy, hp, maxHp: hp, atk: Math.round(enemy.atk * (1 + 0.08 * extra)), def: Math.round(enemy.def * (1 + 0.04 * extra)) };
}

/** A raid boss facing dozens gets a higher ceiling than an ordinary fight (see engine/raid.ts). */
export function enemyAttacksThisRound(standing: number, cap: number = MAX_ENEMY_ATTACKS_PER_ROUND): number {
  return Math.min(cap, 1 + Math.floor(Math.max(0, standing - 1) / 2));
}

/**
 * One simultaneous round of N fighters against one enemy: every standing
 * fighter swings at the enemy, and the enemy answers with 1-3 swings (more
 * the more people stand against it) at randomly chosen standing targets.
 * Faster combatants act first. Ends on the enemy's fall, everyone's fall, or
 * after MAX_JOINT_ROUNDS with the healthier side (by HP ratio) taking it.
 */
export function resolveJointRound(
  rng: Rng,
  round: number,
  fighters: JointFighter[],
  enemy: Combatant,
  enemyHp: number,
  opts: { maxEnemyAttacks?: number } = {}
): JointRoundResult {
  const hp = new Map<string, number>(fighters.map((f) => [f.id, f.hp]));
  const byId = new Map(fighters.map((f) => [f.id, f]));
  let enemyLeft = enemyHp;
  const log: CombatRoundLog[] = [];

  const standing = () => fighters.filter((f) => (hp.get(f.id) ?? 0) > 0);
  const enemyTurns = enemyAttacksThisRound(standing().length, opts.maxEnemyAttacks);

  type Act = { kind: "fighter"; id: string; spd: number } | { kind: "enemy"; index: number; spd: number };
  const acts: Act[] = [
    ...standing().map((f): Act => ({ kind: "fighter", id: f.id, spd: f.combatant.spd })),
    ...Array.from({ length: enemyTurns }, (_, index): Act => ({ kind: "enemy", index, spd: enemy.spd - index })),
  ].sort((a, b) => b.spd - a.spd);

  for (const act of acts) {
    if (enemyLeft <= 0) break;
    const alive = standing();
    if (alive.length === 0) break;
    if (act.kind === "fighter") {
      const f = byId.get(act.id)!;
      if ((hp.get(f.id) ?? 0) <= 0) continue;
      const { damage, outcome, roll } = attackOnce(rng, f.combatant, enemy);
      enemyLeft = Math.max(0, enemyLeft - damage);
      log.push({ round, attacker: f.combatant.name, defender: enemy.name, roll, outcome, damage, defenderHpAfter: enemyLeft });
    } else {
      const target = alive[Math.floor(rng() * alive.length)];
      const { damage, outcome, roll } = attackOnce(rng, enemy, target.combatant);
      const left = Math.max(0, (hp.get(target.id) ?? 0) - damage);
      hp.set(target.id, left);
      log.push({ round, attacker: enemy.name, defender: target.combatant.name, roll, outcome, damage, defenderHpAfter: left });
    }
  }

  const results: JointFighterResult[] = fighters.map((f) => ({ id: f.id, hpAfter: hp.get(f.id) ?? 0, down: (hp.get(f.id) ?? 0) <= 0 }));
  const anyStanding = results.some((r) => !r.down);

  let outcome: JointRoundResult["outcome"] = null;
  if (enemyLeft <= 0) outcome = "victory";
  else if (!anyStanding) outcome = "defeat";
  else if (round >= MAX_JOINT_ROUNDS) {
    const groupRatio = results.reduce((s, r) => s + r.hpAfter, 0) / Math.max(1, fighters.reduce((s, f) => s + f.combatant.maxHp, 0));
    outcome = groupRatio > enemyLeft / Math.max(1, enemy.maxHp) ? "victory" : "defeat";
  }
  return { fighters: results, enemyHpAfter: enemyLeft, log, finished: outcome !== null, outcome };
}
