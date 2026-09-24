import { Character } from "@prisma/client";
import { Combatant } from "../engine/combat";
import { parseFruitEffects, fruitCombatModifier } from "../engine/fruits";
import { regenStamina, fatigueLevel, FATIGUE_MULTIPLIERS, spendStamina, FatigueLevel, EffortLevel, DEFAULT_COMBAT_EFFORT, effortStaminaCost, staminaLossFromDamage, overexertionHpLoss } from "../engine/stamina";
import { resolveTechnique, TechniqueEffect, TechniqueId, hakiGrowthFromUse } from "../engine/techniques";
import { masteryGainFromUse } from "../engine/fruit-mastery";
import { Rng } from "../engine/rng";
import { staminaCostAtLevel } from "../engine/resilience";
import { describeCapabilities } from "../engine/capabilities";
import { toCombatant, characterFruitPhase, wieldedWeapons, CharacterWithGear } from "./derive";
import { chooseTechnique, styleForText, styleGrowthFromUse, getStyle, describeStyles, type StyleUse } from "../engine/styles";
import { prisma } from "../db";

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
export function prepareFighter(character: CharacterWithGear, technique: TechniqueId, tacticModifier: number, hp = character.hp, effort: EffortLevel = DEFAULT_COMBAT_EFFORT, styleText = ""): PreparedFighter {
  const staminaBefore = currentStamina(character);
  let styleCtx: StyleUse | null = null;
  if (technique === "style") {
    const known = (character.styles ?? []).map((s) => ({ id: s.styleId, mastery: s.mastery }));
    const pick = styleForText(known, styleText, wieldedWeapons(character).length, character.styleFocusId);
    if (pick) styleCtx = chooseTechnique(pick.def, pick.mastery, styleText);
  }
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
    style: styleCtx,
  });

  const base = toCombatant(character);
  const stylePierce = effect.used === "style" && effect.styleUse ? (getStyle(effect.styleUse.styleId)?.mods.pierce ?? 0) * 0.25 : 0;
  const fatigue = fatigueLevel(staminaBefore, character.maxStamina);
  const mult = FATIGUE_MULTIPLIERS[fatigue];
  const combatant: Combatant = {
    ...base,
    hp,
    atk: Math.max(1, Math.round((base.atk + effect.atk + tacticModifier) * mult.atk)),
    def: Math.max(1, Math.round((base.def + effect.def + Math.round(tacticModifier / 2)) * mult.def)),
    spd: Math.max(1, Math.round((base.spd + effect.spd) * mult.spd)),
    ...(((base.pierce ?? 0) + stylePierce) > 0 ? { pierce: Math.min(0.5, (base.pierce ?? 0) + stylePierce) } : {}),
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
  if (used === "style" && prepared.effect.styleUse && styleGrowthFromUse(rng, styleMasteryNow(character, prepared.effect.styleUse.styleId)) > 0) {
    // Fire-and-forget: mastery from use is a bonus and must never block or break the fight that earned it.
    void bumpStyleMastery(character.id, prepared.effect.styleUse.styleId);
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

function styleMasteryNow(character: Character & { styles?: { styleId: string; mastery: number }[] }, styleId: string): number {
  return character.styles?.find((s) => s.styleId === styleId)?.mastery ?? 100;
}

async function bumpStyleMastery(characterId: string, styleId: string): Promise<void> {
  try {
    await prisma.characterStyle.updateMany({ where: { characterId, styleId, mastery: { lt: 100 } }, data: { mastery: { increment: 1 } } });
  } catch {
    // best effort
  }
}

/** Everything this character can genuinely do right now, as text for the narrator (used by duels and group fights). */
export function characterCapabilityText(character: CharacterWithGear, companions: string[] = []): string {
  return describeCapabilities({
    name: character.name, level: character.level, armamentHaki: character.armamentHaki, observationHaki: character.observationHaki,
    conquerorsHaki: character.conquerorsHaki, fruitName: character.devilFruit?.name, fruitMastery: character.fruitMastery,
    fruitAwakened: character.fruitAwakened, weaponName: character.equippedWeapon?.name, stamina: currentStamina(character),
    maxStamina: character.maxStamina, hp: character.hp, maxHp: character.maxHp, companions,
    styles: describeStyles((character.styles ?? []).map((s) => ({ id: s.styleId, mastery: s.mastery })), wieldedWeapons(character).length, wieldedWeapons(character).map((w) => w.name)),
  });
}
