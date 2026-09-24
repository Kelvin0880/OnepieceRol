/**
 * Stamina gates how long a character can keep fighting at full tilt. Every
 * technique costs some; at low stamina the body slows (fatigue), at zero it
 * is exhausted. Recovery is resting or slow passive regen over real time —
 * computed lazily from a timestamp on read, no background job.
 */
export const DEFAULT_MAX_STAMINA = 100;
export const STAMINA_REGEN_PER_MINUTE = 2;
export const REST_RECOVERY_FRACTION = 0.6;

export type FatigueLevel = "fresh" | "tired" | "exhausted";

export function regenStamina(current: number, max: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return Math.min(current, max);
  const gained = Math.floor((elapsedMs / 60_000) * STAMINA_REGEN_PER_MINUTE);
  return Math.max(0, Math.min(max, current + gained));
}

export function fatigueLevel(stamina: number, max: number): FatigueLevel {
  if (stamina <= 0) return "exhausted";
  if (stamina / max <= 0.25) return "tired";
  return "fresh";
}

export const FATIGUE_MULTIPLIERS: Record<FatigueLevel, { atk: number; def: number; spd: number }> = {
  fresh: { atk: 1, def: 1, spd: 1 },
  tired: { atk: 0.85, def: 0.9, spd: 0.85 },
  exhausted: { atk: 0.6, def: 0.7, spd: 0.6 },
};

export const FATIGUE_LABELS: Record<FatigueLevel, string> = {
  fresh: "en forma",
  tired: "fatigado",
  exhausted: "exhausto",
};

export function spendStamina(current: number, cost: number): number {
  return Math.max(0, current - Math.max(0, cost));
}

export function restStamina(current: number, max: number): number {
  return Math.min(max, current + Math.round(max * REST_RECOVERY_FRACTION));
}

/**
 * How demanding the move the player described is (judged by the classifier,
 * priced by code): 0 talking/observing, 1 an ordinary strike or dodge, 2 a
 * powerful attack / sprint / combo, 3 an all-out effort. Fighting always
 * costs a little breath; the AI only picks the tier, never the number.
 */
export type EffortLevel = 0 | 1 | 2 | 3;
export const EFFORT_STAMINA_COST: Record<EffortLevel, number> = { 0: 1, 1: 3, 2: 7, 3: 12 };
export const DEFAULT_COMBAT_EFFORT: EffortLevel = 1;

export function clampEffort(n: unknown): EffortLevel {
  const v = Math.round(Number(n));
  return (Number.isFinite(v) ? Math.max(0, Math.min(3, v)) : DEFAULT_COMBAT_EFFORT) as EffortLevel;
}

export function effortStaminaCost(effort: EffortLevel, maxStamina: number): number {
  return Math.max(1, Math.round((EFFORT_STAMINA_COST[effort] * maxStamina) / DEFAULT_MAX_STAMINA));
}

/** Being hit tires you too: a blow worth 25% of your max HP costs about 10 stamina. */
export function staminaLossFromDamage(damageTaken: number, maxHp: number): number {
  if (damageTaken <= 0 || maxHp <= 0) return 0;
  return Math.round((damageTaken / maxHp) * 40);
}

/**
 * Pushing hard on an empty tank hurts: a demanding move (effort 2-3) with no
 * stamina left to pay for it tears something. Bounded and never lethal by itself.
 */
export function overexertionHpLoss(effort: EffortLevel, staminaBefore: number, staminaCost: number, maxHp: number, currentHp: number): number {
  if (effort < 2 || staminaBefore >= staminaCost) return 0;
  const strain = Math.round(maxHp * 0.03 * effort);
  return Math.max(0, Math.min(strain, currentHp - 1));
}
