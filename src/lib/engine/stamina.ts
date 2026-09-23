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
