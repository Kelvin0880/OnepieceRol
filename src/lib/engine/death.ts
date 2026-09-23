import { Rng } from "./rng";

export interface DeathRollInput {
  /** Danger level of the island/encounter, 1-10. */
  islandDanger: number;
  characterLevel: number;
  durability: number;
  willpower: number;
  /** Player-chosen toggle at character creation; softens but never zeroes the risk. */
  permadeath: boolean;
}

export interface DeathRollResult {
  chance: number; // 0-1
  roll: number; // 0-1
  died: boolean;
}

/**
 * Rolled whenever a combatant's HP hits 0. Even a fully "safe mode" run
 * keeps a small floor of risk — the world was never meant to be beatable
 * by stat-checking alone, per design brief: dying, including companions,
 * has to stay a real possibility.
 */
export function rollDeath(rng: Rng, input: DeathRollInput): DeathRollResult {
  const levelGap = Math.max(0, input.islandDanger * 2 - input.characterLevel);
  let chance = 0.12 + levelGap * 0.05;

  chance -= input.durability * 0.004;
  chance -= input.willpower * 0.003;

  if (!input.permadeath) chance *= 0.4;

  chance = Math.max(0.02, Math.min(0.92, chance));

  const roll = rng();
  return { chance, roll, died: roll < chance };
}
