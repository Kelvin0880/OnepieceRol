import { MASTERY_MAX } from "./fruit-mastery";

export type TrainingFocus = "armament" | "observation" | "fruit";
export type TrainingChoice = TrainingFocus | "auto";

export const TRAINING_COOLDOWN_MS = 30 * 60 * 1000;
export const TRAIN_STAMINA_COST = 20;
export const HAKI_MAX = 100;

// Owner's call (2026-10-04): a level 7-8 character with Haki near the top made no sense. Haki, fruit mastery and
// style mastery can only grow as far as the level allows — 10 at level 1, +4 per level — and the full 100 opens at
// level 24, the gate to the New World, where Haki stops being optional. Reachable, not a lifetime grind.
const CAP_AT_LEVEL_1 = 10;
const CAP_PER_LEVEL = 4;

export function levelCap(level: number): number {
  const l = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return Math.min(100, CAP_AT_LEVEL_1 + CAP_PER_LEVEL * (l - 1));
}

export const FULL_MASTERY_LEVEL = Math.ceil((100 - CAP_AT_LEVEL_1) / CAP_PER_LEVEL) + 1;

/** How much of a gain actually fits under the ceiling (never negative: someone already above it simply gains 0). */
export function capGain(current: number, gain: number, ceiling: number): number {
  return Math.max(0, Math.min(gain, ceiling - current));
}

/**
 * Keeps a stat within its ceiling without ever losing a point: anything above goes to the reserve ("bank"), and
 * banked points come back on their own as soon as the ceiling rises (a level up). Idempotent.
 */
export function settleBank(value: number, bank: number, ceiling: number): { value: number; bank: number } {
  if (value > ceiling) return { value: ceiling, bank: bank + (value - ceiling) };
  if (bank > 0 && value < ceiling) {
    const back = Math.min(bank, ceiling - value);
    return { value: value + back, bank: bank - back };
  }
  return { value, bank };
}

export interface TrainingState {
  level: number;
  armamentHaki: number;
  observationHaki: number;
  fruitMastery: number;
  hasFruit: boolean;
}

export function trainingValue(focus: TrainingFocus, s: TrainingState): number {
  return focus === "armament" ? s.armamentHaki : focus === "observation" ? s.observationHaki : s.fruitMastery;
}

export function trainingCeiling(focus: TrainingFocus, s: TrainingState): number {
  return Math.min(levelCap(s.level), focus === "fruit" ? MASTERY_MAX : HAKI_MAX);
}

/** At its ceiling for now: either the absolute max, or the most this level allows. */
export function isTrainingMaxed(focus: TrainingFocus, s: TrainingState): boolean {
  return trainingValue(focus, s) >= trainingCeiling(focus, s);
}

/** True when the ceiling in the way is the level's, not the absolute maximum — leveling up will open it again. */
export function isLevelCapped(focus: TrainingFocus, s: TrainingState): boolean {
  return isTrainingMaxed(focus, s) && trainingCeiling(focus, s) < (focus === "fruit" ? MASTERY_MAX : HAKI_MAX);
}

// "auto" trains whatever is furthest behind, so a fruit user's mastery isn't neglected in favour of Haki (and
// vice versa). A stat already at its ceiling is never picked while another one still has room to grow.
export function autoTrainingFocus(s: TrainingState): TrainingFocus {
  const candidates: TrainingFocus[] = s.hasFruit ? ["armament", "observation", "fruit"] : ["armament", "observation"];
  const growable = candidates.filter((f) => !isTrainingMaxed(f, s));
  const pool = growable.length > 0 ? growable : candidates;
  // Ties go to Haki first (armament, then observation), matching how "auto" always behaved.
  return pool.reduce((best, f) => (trainingValue(f, s) < trainingValue(best, s) ? f : best));
}

export function resolveTrainingFocus(choice: TrainingChoice, s: TrainingState): TrainingFocus {
  if (choice === "auto") return autoTrainingFocus(s);
  if (choice === "fruit" && !s.hasFruit) return autoTrainingFocus(s);
  return choice;
}

export function trainingReadyInMs(lastTrainedAt: Date | string | null | undefined, now = Date.now()): number {
  if (!lastTrainedAt) return 0;
  const at = typeof lastTrainedAt === "string" ? Date.parse(lastTrainedAt) : lastTrainedAt.getTime();
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, at + TRAINING_COOLDOWN_MS - now);
}

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, string> = {
  armament: "Haki de Armadura",
  observation: "Haki de Observación",
  fruit: "Dominio de la fruta",
};
