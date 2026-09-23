import { Rng } from "./rng";
import { skillCheck } from "./checks";

/**
 * Breaking out from the inside. An ordinary brig is one obstacle; Impel Down is
 * one per level, so a prisoner in cell 4 must climb four levels — each a
 * separate attempt, each with a cooldown, and each failure puts the guards on
 * alert and makes the next try harder. A blown attempt is punished: dragged
 * deeper, hurt, locked down.
 */

export const ESCAPE_COOLDOWN_MS = 30 * 60 * 1000;
export const BRIG_LOCKDOWN_MS = 60 * 60 * 1000;
export const MAX_ALERT = 5;
export const ESCAPE_KAIROSEKI_PENALTY = 15;
export const CAUGHT_HP_FRACTION = 0.2;

/** Levels to climb before the prisoner is free: a brig is 1, Impel Down is its cell number. */
export function levelsToEscape(cellLevel: number): number {
  return Math.max(1, cellLevel);
}

export function escapeDifficulty(cellLevel: number, captorPower: number, alert: number): number {
  const d = 55 + cellLevel * 6 + Math.round(captorPower / 10) + Math.min(MAX_ALERT, Math.max(0, alert)) * 4;
  return Math.max(30, Math.min(120, d));
}

export interface EscapeModifierInput {
  agility: number;
  willpower: number;
  intellect: number;
  level: number;
  /** How clever the described plan is (classifier), bounded like any tactic. */
  tacticModifier: number;
  hasDevilFruit: boolean;
}

export function escapeModifier(i: EscapeModifierInput): number {
  return Math.round(i.agility * 0.4 + i.willpower * 0.4 + i.intellect * 0.3 + i.level + i.tacticModifier - (i.hasDevilFruit ? ESCAPE_KAIROSEKI_PENALTY : 0));
}

export type EscapeResult = "breakthrough" | "climb" | "setback" | "caught";

/** breakthrough: climb two levels at once. climb: one level. setback: no progress, guards more alert. caught: dragged back and punished. */
export function attemptEscape(rng: Rng, modifier: number, difficulty: number): EscapeResult {
  const outcome = skillCheck(rng, modifier, difficulty).outcome;
  if (outcome === "critical_success") return "breakthrough";
  if (outcome === "success") return "climb";
  if (outcome === "fail") return "setback";
  return "caught";
}

export interface EscapeState {
  progress: number;
  alert: number;
  cellLevel: number;
}

export interface EscapeStep {
  state: EscapeState;
  free: boolean;
}

/** Applies a result to the prisoner's escape state. Caught in Impel Down drops one cell deeper (max 6) and resets progress; alert resets after any climb. */
export function applyEscapeResult(state: EscapeState, result: EscapeResult): EscapeStep {
  const need = levelsToEscape(state.cellLevel);
  if (result === "breakthrough" || result === "climb") {
    const progress = state.progress + (result === "breakthrough" ? 2 : 1);
    if (progress >= need) return { state: { ...state, progress: need, alert: 0 }, free: true };
    return { state: { ...state, progress, alert: 0 }, free: false };
  }
  if (result === "setback") return { state: { ...state, alert: Math.min(MAX_ALERT, state.alert + 1) }, free: false };
  const cellLevel = state.cellLevel > 0 ? Math.min(6, state.cellLevel + 1) : 0;
  return { state: { progress: 0, alert: Math.min(MAX_ALERT, state.alert + 1), cellLevel }, free: false };
}

export function escapeCooldownLeftMs(lastAttemptAt: Date | null, now: Date): number {
  if (!lastAttemptAt) return 0;
  return Math.max(0, lastAttemptAt.getTime() + ESCAPE_COOLDOWN_MS - now.getTime());
}
