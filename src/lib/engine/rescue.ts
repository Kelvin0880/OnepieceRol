import { Rng } from "./rng";
import { skillCheck, SkillCheckResult } from "./checks";

/**
 * A rescue attempt at a prison: the rescuer's combat power (see
 * `combatPower`) is measured against the captor's strength at the moment
 * of capture (`minRescueLevel`, stored on the Imprisonment record). Like
 * every other check in the engine, a weak rescuer still has a small
 * critical-success chance — nothing is ever a flat wall.
 */
export function attemptPrisonRescue(rng: Rng, rescuerPower: number, minRescueLevel: number): SkillCheckResult {
  const modifier = rescuerPower - minRescueLevel;
  return skillCheck(rng, modifier, 50);
}

export function rescueSucceeded(result: SkillCheckResult): boolean {
  return result.outcome === "success" || result.outcome === "critical_success";
}
