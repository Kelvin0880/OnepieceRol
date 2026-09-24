/**
 * The game owner is whoever's username is listed in ADMIN_USERNAMES (comma-separated). Only the owner can
 * approve the death or capture of a canon character (game/world-arcs.ts). With the variable unset nobody is
 * an admin: those verdicts simply wait.
 *
 * The match is EXACT (case-sensitive): usernames are unique case-sensitively, so a case-insensitive match
 * would let anyone register "KELVIN" and inherit the owner's powers. Lookalike names are refused at signup.
 */
function parseList(env: string | undefined): string[] {
  return (env ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function isAdminUsername(username: string, env: string | undefined = process.env.ADMIN_USERNAMES): boolean {
  return parseList(env).includes(username.trim());
}

/** True when the name differs from an admin name only by case: such a signup could be mistaken for the owner. */
export function isAdminLookalike(username: string, env: string | undefined = process.env.ADMIN_USERNAMES): boolean {
  const u = username.trim();
  return parseList(env).some((a) => a !== u && a.toLowerCase() === u.toLowerCase());
}
