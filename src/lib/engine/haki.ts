import { Rng } from "./rng";

export interface TrainingResult {
  gained: number; // points gained in the trained haki, 0 if the session flopped
  breakthrough: boolean; // rare bonus surge
}

/**
 * A training action at an island's dojo/quiet spot. Diminishing returns as
 * the haki level climbs keep grinding from trivializing difficulty.
 */
export function trainHaki(rng: Rng, currentLevel: number, willpower: number): TrainingResult {
  if (currentLevel >= 100) return { gained: 0, breakthrough: false };

  const diminishing = 1 - currentLevel / 130;
  const roll = rng();

  if (roll < 0.1) return { gained: 0, breakthrough: false }; // flopped session

  const breakthrough = roll > 0.95;
  const base = 2 + Math.round(willpower * 0.08);
  const gained = Math.max(1, Math.round(base * diminishing * (breakthrough ? 3 : 1)));

  return { gained: Math.min(gained, 100 - currentLevel), breakthrough };
}

/**
 * Conqueror's Haki is never trained — canonically it's an innate trait
 * that surfaces under pressure. Roll it once, on a sufficiently dramatic
 * moment (a boss fight, a near-death combat), never on demand.
 */
export function rollConquerorsHakiAwakening(rng: Rng, willpower: number): boolean {
  const chance = 0.01 + willpower * 0.0015;
  return rng() < Math.min(chance, 0.08);
}
