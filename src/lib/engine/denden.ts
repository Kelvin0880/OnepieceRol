/**
 * Den Den Mushi: the faction-wide chat. A message only ever travels inside its own faction
 * (pirates reach pirates, Marines reach Marines...). Pure rules; game/denden.ts stores it.
 */

export const DENDEN_MAX_LENGTH = 400;
export const DENDEN_MIN_GAP_MS = 2000;
export const DENDEN_HISTORY = 60;

/** One channel per player faction. */
export function channelFor(faction: string): string {
  return faction.trim().toUpperCase();
}

export const CHANNEL_LABELS: Record<string, string> = {
  PIRATE: "Piratas",
  MARINE: "Marina",
  REVOLUTIONARY: "Revolucionarios",
  BOUNTY_HUNTER: "Cazarrecompensas",
  CP0: "CP-0",
};

export function channelLabel(faction: string): string {
  return CHANNEL_LABELS[channelFor(faction)] ?? faction;
}

/** Trims, collapses runaway whitespace and rejects empty or oversized text. Returns null when it cannot be sent. */
export function cleanMessage(text: string): string | null {
  const t = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length === 0 || t.length > DENDEN_MAX_LENGTH) return null;
  return t;
}

export function tooFast(lastSentAtMs: number | null, nowMs: number): boolean {
  return lastSentAtMs !== null && nowMs - lastSentAtMs < DENDEN_MIN_GAP_MS;
}
