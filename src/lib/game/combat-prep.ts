import { Character } from "@prisma/client";
import { Combatant } from "../engine/combat";
import { parseFruitEffects, fruitCombatModifier } from "../engine/fruits";
import { regenStamina, fatigueLevel, FATIGUE_MULTIPLIERS, spendStamina, FatigueLevel } from "../engine/stamina";
import { resolveTechnique, TechniqueEffect, TechniqueId, hakiGrowthFromUse } from "../engine/techniques";
import { masteryGainFromUse } from "../engine/fruit-mastery";
import { Rng } from "../engine/rng";
import { toCombatant, characterFruitPhase, CharacterWithGear } from "./derive";

/** Stamina right now: the stored value plus whatever passively regenerated since it was last written. */
export function currentStamina(character: Pick<Character, "stamina" | "maxStamina" | "staminaUpdatedAt">): number {
  if (!character.staminaUpdatedAt) return character.stamina;
  return regenStamina(character.stamina, character.maxStamina, Date.now() - character.staminaUpdatedAt.getTime());
}

export interface PreparedFighter {
  combatant: Combatant;
  effect: TechniqueEffect;
  fatigue: FatigueLevel;
  staminaBefore: number;
  staminaAfter: number;
}

/**
 * Folds everything that shapes one exchange into a single Combatant: the base
 * sheet, the technique the player described (haki/fruit — real bonuses, real
 * stamina cost, silently downgraded if it can't be sustained), the tactic
 * bonus, and fatigue. The engine then rolls with this; the AI never sees a
 * "power level", only the resulting hits and misses.
 */
export function prepareFighter(character: CharacterWithGear, technique: TechniqueId, tacticModifier: number, hp = character.hp): PreparedFighter {
  const staminaBefore = currentStamina(character);
  const fruitBase = character.devilFruit
    ? fruitCombatModifier(parseFruitEffects(character.devilFruit.effectsJson), character.fruitAwakened)
    : null;
  const effect = resolveTechnique(technique, {
    armamentHaki: character.armamentHaki,
    observationHaki: character.observationHaki,
    conquerorsHaki: character.conquerorsHaki,
    fruitBase,
    fruitPhase: characterFruitPhase(character),
    stamina: staminaBefore,
  });

  const base = toCombatant(character);
  const fatigue = fatigueLevel(staminaBefore, character.maxStamina);
  const mult = FATIGUE_MULTIPLIERS[fatigue];
  const combatant: Combatant = {
    ...base,
    hp,
    atk: Math.max(1, Math.round((base.atk + effect.atk + tacticModifier) * mult.atk)),
    def: Math.max(1, Math.round((base.def + effect.def + Math.round(tacticModifier / 2)) * mult.def)),
    spd: Math.max(1, Math.round((base.spd + effect.spd) * mult.spd)),
  };
  return { combatant, effect, fatigue, staminaBefore, staminaAfter: spendStamina(staminaBefore, effect.staminaCost) };
}

/** Everything a fight should persist about the fighter beyond HP: stamina, and any mastery/haki earned by actually using it. */
export function combatProgressData(character: Character, prepared: PreparedFighter, rng: Rng) {
  const data: { stamina: number; staminaUpdatedAt: Date; fruitMastery?: number; armamentHaki?: number; observationHaki?: number } = {
    stamina: prepared.staminaAfter,
    staminaUpdatedAt: new Date(),
  };
  const used = prepared.effect.used;
  if (used === "fruit") {
    const gain = masteryGainFromUse(rng, character.fruitMastery, character.intellect);
    if (gain > 0) data.fruitMastery = character.fruitMastery + gain;
  }
  if (used === "armament") {
    const gain = hakiGrowthFromUse(rng, used, character.armamentHaki);
    if (gain > 0) data.armamentHaki = character.armamentHaki + gain;
  }
  if (used === "observation") {
    const gain = hakiGrowthFromUse(rng, used, character.observationHaki);
    if (gain > 0) data.observationHaki = character.observationHaki + gain;
  }
  return data;
}
