/** Per-kind rules of a joint fight. Keep them here so the classifier, the closing judge and the defeat settlement cannot disagree. */

export type DefeatFate = "custody" | "spared" | "death_roll" | "retreat";

export const canFlee = (kind: string): boolean => kind !== "admiral";

/** Yielding skips the half-life floor only where there is nowhere to run and losing never means death. */
export const surrenderAllowed = (kind: string): boolean => kind === "admiral";

/** An Admiral cannot be fled, so "retreat" makes no sense there: whether felled or still standing, a loss is always custody, never a death roll. */
export function defeatFate(kind: string, status: "DOWN" | "FIGHTING"): DefeatFate {
  if (kind === "admiral") return "custody";
  if (kind === "seat") return "spared";
  return status === "DOWN" ? "death_roll" : "retreat";
}
