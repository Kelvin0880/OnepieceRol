import { Rng } from "./rng";

/**
 * Per-(WorldActor, Character) memory of a specific past incident — the same
 * spike/decay/capped-probability shape pursuit.ts already proved out for
 * "how hunted are you," just scoped to one particular NPC instead of one
 * global pressure. Escaping stings more than losing cleanly, because the
 * NPC never got closure; sparing lowers heat, because mercy is remembered
 * too, not just hostility.
 */

export const GRUDGE_HEAT_SUBORDINATE_DEFEAT = 20; // beating the lieutenant — modest; a real Yonko fight (not built yet) would warrant far more
export const GRUDGE_HEAT_ESCAPE = 35; // escaping mid-fight — "doesn't let go easily," costs more than a clean loss for the NPC
export const GRUDGE_HEAT_MERCY_RELIEF = 15;
export const MAX_GRUDGE_HEAT = 150;
const DECAY_PER_EXPLORE = 2;

export function heatAfterGrudgeIncident(currentHeat: number, kind: "escape" | "subordinate_defeat"): number {
  const delta = kind === "escape" ? GRUDGE_HEAT_ESCAPE : GRUDGE_HEAT_SUBORDINATE_DEFEAT;
  return Math.min(MAX_GRUDGE_HEAT, currentHeat + delta);
}

export function heatAfterMercy(currentHeat: number): number {
  return Math.max(0, currentHeat - GRUDGE_HEAT_MERCY_RELIEF);
}

/** Called once per explore action, whether or not a grudge-ambush fires. */
export function decayGrudgeHeat(currentHeat: number): number {
  return Math.max(0, currentHeat - DECAY_PER_EXPLORE);
}

/**
 * Chance a grudge-holder's ambush preempts the normal exploration roll this
 * turn. Capped below certainty, same shape as hunterAmbushChance — a grudge
 * makes the world more dangerous for you specifically, not inescapable.
 */
export function grudgeAmbushChance(heat: number): number {
  return Math.min(0.3, heat / 350);
}

export function rollGrudgeAmbush(rng: Rng, heat: number): boolean {
  if (heat <= 0) return false;
  return rng() < grudgeAmbushChance(heat);
}
