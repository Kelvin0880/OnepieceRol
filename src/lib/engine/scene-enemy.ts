import { Combatant } from "./combat";

/**
 * Enemies conjured from the scene itself (a bar patron the player attacks, a
 * guard they provoke) have no template — they're built relative to the
 * player's own numbers so a fight is always a real contest, and key rivals
 * sit slightly above the player. The classifier only ever picks the tier
 * label; every number here is code.
 */
export type EnemyTier = "weak" | "average" | "tough" | "elite";

export const ENEMY_TIERS: EnemyTier[] = ["weak", "average", "tough", "elite"];

const TIER_MULTIPLIERS: Record<EnemyTier, { hp: number; atk: number; def: number; spd: number; xp: number }> = {
  weak: { hp: 0.5, atk: 0.8, def: 0.75, spd: 0.85, xp: 2 },
  average: { hp: 0.85, atk: 0.95, def: 0.95, spd: 0.95, xp: 8 },
  tough: { hp: 1.1, atk: 1.05, def: 1.05, spd: 1, xp: 14 },
  elite: { hp: 1.4, atk: 1.2, def: 1.15, spd: 1.1, xp: 24 },
};

export function isEnemyTier(value: unknown): value is EnemyTier {
  return typeof value === "string" && (ENEMY_TIERS as string[]).includes(value);
}

export function tierXp(tier: EnemyTier): number {
  return TIER_MULTIPLIERS[tier].xp;
}

export function buildSceneEnemy(name: string, player: Combatant, tier: EnemyTier): Combatant {
  const m = TIER_MULTIPLIERS[tier];
  const hp = Math.max(10, Math.round(player.maxHp * m.hp));
  return {
    name,
    hp,
    maxHp: hp,
    atk: Math.max(4, Math.round(player.atk * m.atk)),
    def: Math.max(2, Math.round(player.def * m.def)),
    spd: Math.max(2, Math.round(player.spd * m.spd)),
  };
}
