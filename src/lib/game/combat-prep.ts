import { Character } from "@prisma/client";
import { Combatant } from "../engine/combat";
import { parseFruitEffects, fruitCombatModifier } from "../engine/fruits";
import { regenStamina, fatigueLevel, FATIGUE_MULTIPLIERS, spendStamina, FatigueLevel, EffortLevel, DEFAULT_COMBAT_EFFORT, effortStaminaCost, staminaLossFromDamage, overexertionHpLoss } from "../engine/stamina";
import { resolveTechnique, TechniqueEffect, TechniqueId, hakiGrowthFromUse } from "../engine/techniques";
import { masteryGainFromUse } from "../engine/fruit-mastery";
import { Rng } from "../engine/rng";
import { staminaCostAtLevel } from "../engine/resilience";
import { describeCapabilities } from "../engine/capabilities";
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
  effort: EffortLevel;
  /** HP lost purely from straining on an empty tank; the caller subtracts it (never lethal). */
  strainHp: number;
}

/**
 * Folds everything that shapes one exchange into a single Combatant: the base
 * sheet, the technique the player described (haki/fruit — real bonuses, real
 * stamina cost, silently downgraded if it can't be sustained), the tactic
 * bonus, and fatigue. The engine then rolls with this; the AI never sees a
 * "power level", only the resulting hits and misses.
 */
export function prepareFighter(character: CharacterWithGear, technique: TechniqueId, tacticModifier: number, hp = character.hp, effort: EffortLevel = DEFAULT_COMBAT_EFFORT): PreparedFighter {
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
  const effortCost = effortStaminaCost(effort, character.maxStamina);
  // Experience makes every action cheaper: a veteran spends less breath on the same move.
  const totalCost = staminaCostAtLevel(effect.staminaCost + effortCost, character.level);
  return {
    combatant,
    effect,
    fatigue,
    staminaBefore,
    staminaAfter: spendStamina(staminaBefore, totalCost),
    effort,
    strainHp: overexertionHpLoss(effort, staminaBefore, totalCost, character.maxHp, hp),
  };
}

/** Everything a fight should persist about the fighter beyond HP: stamina, and any mastery/haki earned by actually using it. */
export function combatProgressData(character: Character, prepared: PreparedFighter, rng: Rng, damageTaken = 0) {
  const data: { stamina: number; staminaUpdatedAt: Date; fruitMastery?: number; armamentHaki?: number; observationHaki?: number } = {
    stamina: spendStamina(prepared.staminaAfter, staminaCostAtLevel(staminaLossFromDamage(damageTaken, character.maxHp), character.level)),
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

/** Everything this character can genuinely do right now, as text for the narrator (used by duels and group fights). */
export function characterCapabilityText(character: CharacterWithGear, companions: string[] = []): string {
  return describeCapabilities({
    name: character.name, level: character.level, armamentHaki: character.armamentHaki, observationHaki: character.observationHaki,
    conquerorsHaki: character.conquerorsHaki, fruitName: character.devilFruit?.name, fruitMastery: character.fruitMastery,
    fruitAwakened: character.fruitAwakened, weaponName: character.equippedWeapon?.name, stamina: currentStamina(character),
    maxStamina: character.maxStamina, hp: character.hp, maxHp: character.maxHp, companions,
  });
}
