/**
 * Who may hunt whom without the target's consent (real PvP, to the death).
 * Marines and Cipher Pol hunt pirates and revolutionaries; pirates prey on
 * everyone outside their own flag; bounty hunters go after pirates; the
 * Revolutionary Army and the Government are sworn enemies. Same faction is
 * never hostile — those fights need mutual consent (a friendly duel, or an
 * agreed duel to the death).
 */
export type PlayerFaction = "PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER" | "CP0";

const GOVERNMENT: PlayerFaction[] = ["MARINE", "CP0"];

export function areHostile(a: PlayerFaction, b: PlayerFaction): boolean {
  if (a === b) return false;
  if (a === "PIRATE" || b === "PIRATE") return true;
  const aGov = GOVERNMENT.includes(a);
  const bGov = GOVERNMENT.includes(b);
  if ((aGov && b === "REVOLUTIONARY") || (bGov && a === "REVOLUTIONARY")) return true;
  return false;
}

/** Newcomers can't be hunted: below this level a character is off-limits to non-consensual lethal PvP. */
export const HUNT_MIN_TARGET_LEVEL = 3;
/** A hunted target must have been seen online this recently — nobody is killed while away from the keyboard. */
export const HUNT_ONLINE_WINDOW_MS = 3 * 60_000;
/** After a hunt ends (escape or kill) the same hunter can't re-target the same person for this long. */
export const HUNT_REPEAT_COOLDOWN_MS = 30 * 60_000;
/** How long a hunted player has to answer before they are considered to have slipped away. */
export const HUNT_RESPONSE_WINDOW_MS = 5 * 60_000;

export function huntBlockReason(p: { targetLevel: number; targetLastSeenAt: Date | null; lastHuntEndedAt: Date | null; now?: Date }): string | null {
  const now = p.now ?? new Date();
  if (p.targetLevel < HUNT_MIN_TARGET_LEVEL) return "Los recién llegados están bajo protección: no puedes cazar a alguien de nivel tan bajo.";
  if (!p.targetLastSeenAt || now.getTime() - p.targetLastSeenAt.getTime() > HUNT_ONLINE_WINDOW_MS) {
    return "Su rastro se ha enfriado: esa persona no está conectada ahora mismo, así que no puedes darle caza.";
  }
  if (p.lastHuntEndedAt && now.getTime() - p.lastHuntEndedAt.getTime() < HUNT_REPEAT_COOLDOWN_MS) {
    return "Acabas de perseguir a esta persona; déjala respirar un rato antes de volver a por ella.";
  }
  return null;
}
