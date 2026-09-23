import { Combatant } from "./combat";
import { Rng } from "./rng";
import { skillCheck } from "./checks";

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

export interface FleeResult {
  success: boolean;
  hpLoss: number;
}

/**
 * Fleeing is a speed contest: outrun the enemy and escape clean, or get
 * clipped on the way out. Never free, and never impossible — you can
 * always try to run even from something you have no business fighting.
 */
export function attemptFlee(rng: Rng, player: Combatant, enemy: Combatant): FleeResult {
  const modifier = (player.spd - enemy.spd) * 2;
  const check = skillCheck(rng, modifier, 50);
  const succeeded = check.outcome === "success" || check.outcome === "critical_success";
  const hpLoss = succeeded ? 0 : Math.round(enemy.atk * (check.outcome === "critical_fail" ? 0.6 : 0.3));
  return { success: succeeded, hpLoss };
}
