import { Rng } from "./rng";

/**
 * Poneglyphs are carved stone — nobody steals them back. What a reader
 * accumulates instead is `poneglyphHeat`: how urgently the power that lost
 * the secret wants the reader silenced. It spikes hard on every new
 * Poneglyph and fades on its own as the trail goes cold, but while it's
 * up, the world actively comes looking.
 */

const HEAT_PER_PONEGLYPH = 50;
const DECAY_PER_EXPLORE = 3;
const MAX_HEAT = 150;

/** `amount` lets a stealthy read leave a fainter trail than a fight that shook the whole island. */
export function heatAfterReadingPoneglyph(currentHeat: number, amount: number = HEAT_PER_PONEGLYPH): number {
  return Math.min(MAX_HEAT, currentHeat + amount);
}

/** Called once per explore action, whether or not a hunter shows up. */
export function decayPursuitHeat(currentHeat: number): number {
  return Math.max(0, currentHeat - DECAY_PER_EXPLORE);
}

/**
 * Chance a hunter ambush preempts the normal exploration roll this turn.
 * Scales with heat but is capped well below certainty — even freshly
 * marked, you get to actually play, not just get executed on sight.
 */
export function hunterAmbushChance(heat: number): number {
  return Math.min(0.35, heat / 300);
}

export function rollHunterAmbush(rng: Rng, heat: number): boolean {
  if (heat <= 0) return false;
  return rng() < hunterAmbushChance(heat);
}
