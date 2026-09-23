/**
 * The Grand Line doesn't ease you in — some islands simply refuse entry
 * below a level, the way canon gates Reverse Mountain and beyond behind
 * actually surviving East Blue first.
 */
export function canEnterIsland(characterLevel: number, minLevelToEnter: number): boolean {
  return characterLevel >= minLevelToEnter;
}
