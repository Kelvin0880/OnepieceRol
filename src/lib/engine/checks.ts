/**
 * Difficulty class for an encounter, derived from island danger level and
 * how far above/below the character's level it sits. Islands scale from
 * DC 20 (sleepy East Blue village) to DC 95+ (New World Yonko territory).
 * It is only a description of how hard the place is: the AI judge (ai/judge.ts) decides the result.
 */
export function encounterDifficulty(islandDanger: number, characterLevel: number): number {
  const base = 10 + islandDanger * 8;
  const levelSoftener = Math.min(characterLevel * 2, islandDanger * 6);
  return Math.max(5, Math.min(99, base - levelSoftener));
}
