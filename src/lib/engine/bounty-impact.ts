/**
 * A pirate's bounty is fame: it should move in millions, grow faster the more famous they already are, and jump when
 * they beat somebody who matters. Pure rules; game code applies them at the few places bounty is earned.
 * Non-pirates keep the older, smaller notoriety scale.
 */

/** The old fight bounty (thousands) times this reaches millions for pirates. */
export const PIRATE_FIGHT_BOUNTY_SCALE = 30;

export const CANON_BOUNTY_CAP = 600_000_000;

/** Raw bounty from a fight or an exploration for whoever earns it: pirates get the millions scale, everyone else unchanged. */
export function bountyForFaction(faction: string, raw: number): number {
  return faction === "PIRATE" ? Math.round(raw * PIRATE_FIGHT_BOUNTY_SCALE) : raw;
}

/** Below 10M nothing changes; then each extra gain grows with the poster, up to triple at ~490M. */
export function fameFactor(currentBounty: number): number {
  return 1 + Math.min(2, Math.max(0, (currentBounty - 10_000_000) / 240_000_000));
}

export type CanonFightKind = "vanguard" | "canon" | "admiral" | "guardian";

const KIND_SHARE: Record<CanonFightKind, number> = { vanguard: 0.25, canon: 1, admiral: 0.8, guardian: 0.5 };

/**
 * What beating this canon character adds to a pirate's bounty. It follows who they are: the larger of their own canon
 * bounty (8%) and a power curve, scaled by how the fight went in the story (a subordinate is worth a quarter of the leader).
 */
export function canonDefeatBounty(actor: { powerLevel: number; canonBounty?: bigint | number | null }, kind: CanonFightKind): number {
  const power = Math.max(1, actor.powerLevel);
  const own = actor.canonBounty ? Number(actor.canonBounty) * 0.08 : 0;
  const base = Math.max(own, power * power * 30_000);
  const share = KIND_SHARE[kind];
  return Math.min(CANON_BOUNTY_CAP, Math.max(Math.round(power * 250_000 * share), Math.round(base * share)));
}
