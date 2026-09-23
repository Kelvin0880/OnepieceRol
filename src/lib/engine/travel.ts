/**
 * The Grand Line doesn't ease you in — some islands simply refuse entry
 * below a level, the way canon gates Reverse Mountain and beyond behind
 * actually surviving East Blue first.
 */
export function canEnterIsland(characterLevel: number, minLevelToEnter: number): boolean {
  return characterLevel >= minLevelToEnter;
}

export const TRAVEL_STAMINA_COST = 10;

export const TIDE_WINDOW_MS = 3 * 3600_000;

/**
 * A tidal island (Isla Abismo) surfaces in alternating 3-hour windows of real
 * time: open, closed, open... `msUntilChange` is how long the current state
 * lasts, so a closed island tells the player exactly how long to wait.
 */
export function tideStatus(now: Date = new Date()): { open: boolean; msUntilChange: number } {
  const t = now.getTime();
  const slot = Math.floor(t / TIDE_WINDOW_MS);
  return { open: slot % 2 === 0, msUntilChange: (slot + 1) * TIDE_WINDOW_MS - t };
}

/** Laugh Tale can only be found by someone who has read every Road Poneglyph that exists. */
export function knowsTheRoad(read: string[], roadPoneglyphIds: string[]): boolean {
  return roadPoneglyphIds.length > 0 && roadPoneglyphIds.every((id) => read.includes(id));
}

/** Real-time cooldown after sailing: 6 min base + 2 min per point of the destination's danger (8-26 min). */
export function travelCooldownMs(destinationDanger: number): number {
  return (6 + Math.max(0, destinationDanger) * 2) * 60_000;
}

/** Milliseconds until the character may sail again; 0 when ready (or never traveled). */
export function travelWaitMs(lastTravelAt: Date | null, destinationDanger: number, now: Date = new Date()): number {
  if (!lastTravelAt) return 0;
  return Math.max(0, lastTravelAt.getTime() + travelCooldownMs(destinationDanger) - now.getTime());
}
