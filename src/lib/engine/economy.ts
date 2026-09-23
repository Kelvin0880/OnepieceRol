const RARITY_PRICE_MULTIPLIER: Record<string, number> = {
  COMMON: 1,
  UNCOMMON: 2.2,
  RARE: 5,
  EPIC: 12,
  LEGENDARY: 30,
  MYTHICAL_TIER: 80,
};

const WEAPON_GRADE_MULTIPLIER: Record<string, number> = {
  NONE: 1,
  WAZAMONO: 3,
  RYO_WAZAMONO: 8,
  O_WAZAMONO: 20,
  SAIJO_O_WAZAMONO: 60,
  UNIQUE: 45,
};

export function fruitBlackMarketPrice(rarity: keyof typeof RARITY_PRICE_MULTIPLIER): number {
  return Math.round(50_000 * (RARITY_PRICE_MULTIPLIER[rarity] ?? 1));
}

export function weaponPrice(basePrice: number, grade: keyof typeof WEAPON_GRADE_MULTIPLIER): number {
  return Math.round(basePrice * (WEAPON_GRADE_MULTIPLIER[grade] ?? 1));
}

/**
 * Bounty granted for a victory, scaled by how dangerous the target was
 * relative to the character's own level — beating up small fry barely
 * moves the needle, the way canon bounty jumps work.
 */
export function bountyReward(islandDanger: number, characterLevel: number, isBoss: boolean): number {
  const base = islandDanger * islandDanger * 1500;
  const levelPenalty = Math.max(0.25, 1 - Math.max(0, characterLevel - islandDanger * 2) * 0.05);
  const bossMultiplier = isBoss ? 4.5 : 1;
  return Math.round(base * levelPenalty * bossMultiplier);
}

export function berryReward(islandDanger: number, isBoss: boolean): number {
  const base = 200 + islandDanger * 350;
  return Math.round(base * (isBoss ? 3 : 1));
}

/** Simple level curve: how much XP separates level N from N+1. */
export function xpToNextLevel(level: number): number {
  return Math.round(100 * Math.pow(1.35, level - 1));
}

/** A devil fruit user is a far more valuable — and dangerous — catch to let go of. */
const KAIROSEKI_BAIL_PREMIUM = 1.6;

/**
 * Bail scales with how dangerous the capture was — walking free from a
 * scuffle costs little, buying your way out after a failed crew battle on
 * a dangerous island costs real money. A devil fruit user held in Kairoseki
 * (seastone) costs extra: their captor knows exactly what they're letting
 * walk free.
 */
export function computeBailBerries(islandDanger: number, level: number, hasDevilFruit: boolean = false): number {
  const base = Math.round((500 + islandDanger * 400) * (1 + level * 0.15));
  return hasDevilFruit ? Math.round(base * KAIROSEKI_BAIL_PREMIUM) : base;
}
