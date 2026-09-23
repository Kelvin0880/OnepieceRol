import { Rng, rollD100 } from "./rng";

export type CheckOutcome = "critical_fail" | "fail" | "success" | "critical_success";

export interface SkillCheckResult {
  roll: number;
  modifier: number;
  total: number;
  difficulty: number;
  outcome: CheckOutcome;
  margin: number; // total - difficulty, negative on failure
}

/**
 * The single resolution primitive used everywhere: d100 + modifier vs a
 * difficulty class. Rolls of 1-5 are always a critical failure and 96-100
 * are always a critical success, regardless of modifiers — no amount of
 * stacking stats makes the world risk-free, which is the point.
 */
export function skillCheck(rng: Rng, modifier: number, difficulty: number): SkillCheckResult {
  const roll = rollD100(rng);
  const total = roll + modifier;
  const margin = total - difficulty;

  let outcome: CheckOutcome;
  if (roll <= 5) outcome = "critical_fail";
  else if (roll >= 96) outcome = "critical_success";
  else if (margin >= 0) outcome = "success";
  else outcome = "fail";

  return { roll, modifier, total, difficulty, outcome, margin };
}

/**
 * Difficulty class for an encounter, derived from island danger level and
 * how far above/below the character's level it sits. Islands scale from
 * DC 20 (sleepy East Blue village) to DC 95+ (New World Yonko territory).
 */
export function encounterDifficulty(islandDanger: number, characterLevel: number): number {
  const base = 10 + islandDanger * 8;
  const levelSoftener = Math.min(characterLevel * 2, islandDanger * 6);
  return Math.max(5, Math.min(99, base - levelSoftener));
}
