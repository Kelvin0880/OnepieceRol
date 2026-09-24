/**
 * Experience makes bodies harder to break. A level-20 fighter loses less HP
 * and less stamina per action than a level-1 one — for players, allies and
 * enemies alike (the same functions price everyone). Pure.
 */
import type { Combatant } from "./combat";
import { EffortLevel, FATIGUE_MULTIPLIERS, effortStaminaCost, fatigueLevel, spendStamina, staminaLossFromDamage, DEFAULT_MAX_STAMINA } from "./stamina";

export const RESILIENCE_PER_LEVEL = 0.02;
export const RESILIENCE_FLOOR = 0.5;

/** Multiplier on damage taken and on stamina spent: 1 at level 1 (or unknown), shrinking with level down to a floor. */
export function levelResilience(level?: number): number {
  if (!level || level <= 1) return 1;
  return Math.max(RESILIENCE_FLOOR, 1 / (1 + RESILIENCE_PER_LEVEL * (level - 1)));
}

/** Rough level for enemies that were authored without one, read off their combat numbers. */
export function estimateLevel(atk: number, def: number): number {
  return Math.max(1, Math.round((atk + def) / 3.5 - 4));
}

/** Damage after the defender's experience soaks some of it; a landed hit always does at least 1. */
export function soakDamage(rawDamage: number, defenderLevel?: number): number {
  if (rawDamage <= 0) return 0;
  return Math.max(1, Math.round(rawDamage * levelResilience(defenderLevel)));
}

/** Stamina price of an action for someone of this level (experienced fighters waste less breath). */
export function staminaCostAtLevel(baseCost: number, level?: number): number {
  if (baseCost <= 0) return 0;
  return Math.max(1, Math.round(baseCost * levelResilience(level)));
}

/** A tired NPC or enemy hits, defends and moves worse — the same table players use. */
export function applyFatigueToCombatant(c: Combatant, stamina: number, maxStamina = DEFAULT_MAX_STAMINA): Combatant {
  const m = FATIGUE_MULTIPLIERS[fatigueLevel(stamina, maxStamina)];
  return { ...c, atk: Math.max(1, Math.round(c.atk * m.atk)), def: Math.max(1, Math.round(c.def * m.def)), spd: Math.max(1, Math.round(c.spd * m.spd)) };
}

/** Enemies and NPC allies swing at a steady moderate pace unless told otherwise; bosses push harder. */
export function npcBaseEffort(isBoss: boolean): EffortLevel {
  return isBoss ? 2 : 1;
}

/** Stamina an NPC has left after one exchange: what its own effort cost, plus the fatigue of the blows it took. */
export function npcStaminaAfterExchange(p: { stamina: number; level?: number; effort: EffortLevel; damageTaken: number; maxHp: number }): number {
  const effort = staminaCostAtLevel(effortStaminaCost(p.effort, DEFAULT_MAX_STAMINA), p.level);
  const hits = staminaCostAtLevel(staminaLossFromDamage(p.damageTaken, p.maxHp), p.level);
  return spendStamina(p.stamina, effort + hits);
}
