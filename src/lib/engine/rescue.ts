import { Rng } from "./rng";
import { skillCheck, SkillCheckResult } from "./checks";

/** A devil fruit user in Kairoseki (seastone) restraints is guarded far more heavily. */
export const KAIROSEKI_RESCUE_PENALTY = 15;

/**
 * A rescue attempt at a prison: the rescuer's combat power (see
 * `combatPower`) is measured against the captor's strength at the moment
 * of capture (`minRescueLevel`, stored on the Imprisonment record). Like
 * every other check in the engine, a weak rescuer still has a small
 * critical-success chance — nothing is ever a flat wall. A devil fruit
 * user's own power doesn't help them here — Kairoseki neutralizes it
 * completely while they're chained — but it does mean their captors
 * know exactly how dangerous a clean escape would be, and guard
 * accordingly.
 */
export function attemptPrisonRescue(rng: Rng, rescuerPower: number, minRescueLevel: number, prisonerHasDevilFruit: boolean = false): SkillCheckResult {
  const modifier = rescuerPower - minRescueLevel - (prisonerHasDevilFruit ? KAIROSEKI_RESCUE_PENALTY : 0);
  return skillCheck(rng, modifier, 50);
}

export function rescueSucceeded(result: SkillCheckResult): boolean {
  return result.outcome === "success" || result.outcome === "critical_success";
}
