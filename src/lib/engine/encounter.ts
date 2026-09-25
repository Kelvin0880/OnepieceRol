import { Combatant } from "./combat";

export type ThreatAssessment = "weaker" | "even" | "superior";

/** Single scalar comparing combatants — same yardstick used for threat reads, captor strength, and rescue checks. */
export function combatPower(c: Combatant): number {
  return c.atk + c.def + c.spd;
}

/**
 * A read on how the fight would likely go, shown to the player before they
 * commit — not a guarantee (Observation Haki can be fooled, and a "superior"
 * foe can still be beaten through sheer luck or a lucky critical), but
 * enough information to make fight-or-flee a real decision instead of a
 * coin flip.
 */
export function assessThreat(player: Combatant, enemy: Combatant): ThreatAssessment {
  const ratio = combatPower(enemy) / Math.max(1, combatPower(player));
  if (ratio < 0.75) return "weaker";
  if (ratio > 1.3) return "superior";
  return "even";
}
