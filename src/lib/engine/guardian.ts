import { Rng } from "./rng";
import { skillCheck } from "./checks";

/**
 * Poneglyph guardians: who actually stands between a player and the stone.
 * A holder (a WorldActor) is either home — and then usually meets you in
 * person — or away on the world's business (busyUntil, the same clock the
 * background world-tick already uses), leaving a subordinate on watch. A
 * player can also skip the fight entirely by slipping in unseen.
 */

export const REAL_ACTOR_MEET_CHANCE = 0.75;
export const STEALTH_STAMINA_COST = 15;
/** A success that beats the difficulty by this much leaves no witness at all. */
export const CLEAN_MARGIN = 20;

export function isActorHome(busyUntil: Date | null, now: Date): boolean {
  return !busyUntil || busyUntil.getTime() <= now.getTime();
}

/** Combat stats for a canon holder fighting in person, from their 1-100 power level: meant to need a coordinated group, not one player. */
export function actorCombatStats(powerLevel: number): { hp: number; atk: number; def: number; spd: number } {
  const p = Math.max(1, Math.min(100, powerLevel));
  return { hp: Math.round(p * 16), atk: Math.round(p * 1.6), def: Math.round(p * 1.05), spd: Math.round(p * 0.75) };
}

export function guardianMeeting(rng: Rng, actorHome: boolean): "actor" | "subordinate" {
  if (!actorHome) return "subordinate";
  return rng() < REAL_ACTOR_MEET_CHANCE ? "actor" : "subordinate";
}

export interface StealthDifficultyInput {
  islandDanger: number;
  actorHome: boolean;
  poneglyphHeat: number;
  grudgeHeat: number;
}

/** Harder when the holder is home, when you're already hunted, and when this holder specifically remembers you. */
export function stealthDifficulty(i: StealthDifficultyInput): number {
  const d = 35 + i.islandDanger * 4 + (i.actorHome ? 18 : 0) + Math.min(20, Math.round(i.poneglyphHeat / 6)) + Math.min(15, Math.round(i.grudgeHeat / 10));
  return Math.max(20, Math.min(110, d));
}

export interface StealthModifierInput {
  agility: number;
  intellect: number;
  observationHaki: number;
  level: number;
  /** How clever the described approach is, judged by the classifier and bounded the same way a combat tactic is. */
  tacticModifier: number;
}

export function stealthModifier(i: StealthModifierInput): number {
  return Math.round(i.agility * 0.5 + i.intellect * 0.3 + i.observationHaki * 0.3 + i.level + i.tacticModifier);
}

export type StealthResult = "clean" | "noticed" | "spotted" | "caught";

/**
 * clean: read it and left without anyone knowing. noticed: read it, but a
 * guard saw a shape leave. spotted: seen before reading — the guardian
 * comes. caught: seen at the worst moment — the guardian strikes first.
 */
export function attemptStealthRead(rng: Rng, modifier: number, difficulty: number): StealthResult {
  const check = skillCheck(rng, modifier, difficulty);
  const outcome = check.outcome;
  if (outcome === "critical_success" || (outcome === "success" && check.margin >= CLEAN_MARGIN)) return "clean";
  if (outcome === "success") return "noticed";
  if (outcome === "fail") return "spotted";
  return "caught";
}

export const STEALTH_HEAT: Record<"clean" | "noticed", number> = { clean: 20, noticed: 50 };
export const CAUGHT_HP_FRACTION = 0.2;
