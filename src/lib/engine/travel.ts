/**
 * The Grand Line doesn't ease you in — some islands simply refuse entry
 * below a level, the way canon gates Reverse Mountain and beyond behind
 * actually surviving East Blue first.
 */
export function canEnterIsland(characterLevel: number, minLevelToEnter: number): boolean {
  return characterLevel >= minLevelToEnter;
}

export const TRAVEL_STAMINA_COST = 10;

/** Real-time cooldown after sailing: 6 min base + 2 min per point of the destination's danger (8-26 min). */
export function travelCooldownMs(destinationDanger: number): number {
  return (6 + Math.max(0, destinationDanger) * 2) * 60_000;
}

/** Milliseconds until the character may sail again; 0 when ready (or never traveled). */
export function travelWaitMs(lastTravelAt: Date | null, destinationDanger: number, now: Date = new Date()): number {
  if (!lastTravelAt) return 0;
  return Math.max(0, lastTravelAt.getTime() + travelCooldownMs(destinationDanger) - now.getTime());
}
