
/**
 * A devil fruit never gives its full power at once. Three phases:
 *  - initial:  basic mastery, weak output, expensive to use;
 *  - advanced: variants/combos, full base output, cheaper;
 *  - awakened: the ultimate — needs a breaking-point event, not just grind.
 */
export type FruitPhase = "initial" | "advanced" | "awakened";

export const MASTERY_MAX = 100;
export const ADVANCED_THRESHOLD = 35;

export function fruitPhase(mastery: number, awakened: boolean): FruitPhase {
  if (awakened) return "awakened";
  return mastery >= ADVANCED_THRESHOLD ? "advanced" : "initial";
}

export const FRUIT_PHASE_LABELS: Record<FruitPhase, string> = {
  initial: "Fase inicial",
  advanced: "Fase avanzada",
  awakened: "Despertar",
};

/** Multiplier on the fruit's base combat bonuses. Awakened additionally unlocks the fruit's own `awakened` bonuses (see fruits.ts). */
export function fruitPowerMultiplier(phase: FruitPhase): number {
  return phase === "initial" ? 0.6 : 1;
}

/** Multiplier on the stamina cost of a fruit technique: raw power is costly, mastery makes it efficient. */
export function fruitStaminaMultiplier(phase: FruitPhase): number {
  return phase === "initial" ? 1.5 : phase === "advanced" ? 1 : 0.75;
}

/** Mastery gained from using the fruit in a fight, with diminishing returns like haki training. */
export function masteryGainFromUse(mastery: number, intellect: number): number {
  if (mastery >= MASTERY_MAX) return 0;
  const base = 2 + Math.round(intellect * 0.06);
  const gained = Math.max(1, Math.round(base * (1 - mastery / 140)));
  return Math.min(gained, MASTERY_MAX - mastery);
}

/** Dedicated training focused on the fruit: a bigger, steadier gain than incidental use; a new phase is a breakthrough. */
export function trainFruitMastery(mastery: number, intellect: number): { gained: number; breakthrough: boolean } {
  if (mastery >= MASTERY_MAX) return { gained: 0, breakthrough: false };
  const base = 3 + Math.round(intellect * 0.1);
  let gained = Math.max(1, Math.round(base * (1 - mastery / 140)));
  const breakthrough = Math.floor((mastery + gained) / 25) > Math.floor(mastery / 25);
  if (breakthrough) gained *= 2;
  return { gained: Math.min(gained, MASTERY_MAX - mastery), breakthrough };
}

/**
 * The breaking-point rule for the Awakening: mastery already maxed, and the
 * player just won a fight that pushed them to the edge (a boss, or winning
 * while under a quarter of their health).
 */
export function canAwaken(mastery: number, awakened: boolean, ctx: { enemyIsBoss: boolean; playerHpRatio: number }): boolean {
  if (awakened || mastery < MASTERY_MAX) return false;
  return ctx.enemyIsBoss || ctx.playerHpRatio <= 0.25;
}
