/**
 * Per-kind rules of a joint fight, in one place: what an inescapable Admiral fight or a non-lethal seat duel allows
 * used to be re-decided with `kind === ...` in the classifier, the closing judge and the defeat settlement.
 */

export type DefeatFate = "custody" | "spared" | "death_roll" | "retreat";

export const canFlee = (kind: string): boolean => kind !== "admiral";

/** Yielding skips the half-life floor only where there is nowhere to run and losing never means death. */
export const surrenderAllowed = (kind: string): boolean => kind === "admiral";

export function defeatFate(kind: string, status: "DOWN" | "FIGHTING"): DefeatFate {
  if (kind === "admiral") return "custody";
  if (kind === "seat") return "spared";
  return status === "DOWN" ? "death_roll" : "retreat";
}
