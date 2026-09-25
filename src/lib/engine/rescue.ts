/** A devil fruit user in Kairoseki (seastone) restraints is guarded far more heavily. */
export const KAIROSEKI_RESCUE_PENALTY = 15;

/**
 * A rescue attempt at a prison: the rescuer's combat power (see `combatPower`) is measured against the captor's
 * strength at the moment of capture (`minRescueLevel`). The AI judge (ai/judge.ts) decides how it goes; this only
 * says how far ahead or behind the rescuer stands. A devil fruit user's own power does not help them here:
 * Kairoseki neutralizes it while they are chained, and their captors guard them accordingly.
 */
export function rescueEdge(rescuerPower: number, minRescueLevel: number, prisonerHasDevilFruit = false): number {
  return rescuerPower - minRescueLevel - (prisonerHasDevilFruit ? KAIROSEKI_RESCUE_PENALTY : 0);
}

export function rescueSucceeded(outcome: "critical_success" | "success" | "fail" | "critical_fail"): boolean {
  return outcome === "success" || outcome === "critical_success";
}
