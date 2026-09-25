export interface TrainingResult {
  gained: number; // points gained in the trained haki
  breakthrough: boolean; // crossing a tier (every 10 points) is a surge
}

/**
 * A training action at an island's dojo/quiet spot. Steady, with diminishing returns as the haki level climbs
 * so grinding cannot trivialize difficulty; reaching a new tier of ten is a breakthrough that doubles the session.
 */
export function trainHaki(currentLevel: number, willpower: number): TrainingResult {
  if (currentLevel >= 100) return { gained: 0, breakthrough: false };
  const diminishing = 1 - currentLevel / 130;
  const base = 2 + Math.round(willpower * 0.08);
  let gained = Math.max(1, Math.round(base * diminishing));
  const breakthrough = Math.floor((currentLevel + gained) / 10) > Math.floor(currentLevel / 10);
  if (breakthrough) gained *= 2;
  return { gained: Math.min(gained, 100 - currentLevel), breakthrough };
}

/**
 * Conqueror's Haki is never trained: it surfaces in a dramatic moment for someone whose will and Haki are already
 * formidable (a boss fight, a near-death win). No chance involved: the conditions are the rule.
 */
export function conquerorsHakiAwakens(willpower: number, armamentHaki: number, observationHaki: number): boolean {
  return willpower >= 60 && armamentHaki >= 40 && observationHaki >= 40;
}
