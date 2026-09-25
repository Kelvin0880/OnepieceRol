import type { Combatant } from "./combat";

/** A joint fight round is judged by the AI referee (engine/referee.ts); only the group helpers live here. */

export const MAX_JOINT_ROUNDS = Number.POSITIVE_INFINITY; // live fights end only by HP or fleeing
export const MAX_ENEMY_ATTACKS_PER_ROUND = 3;

export interface JointFighter {
  id: string;
  combatant: Combatant;
  hp: number;
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
