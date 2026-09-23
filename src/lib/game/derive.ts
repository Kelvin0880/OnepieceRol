import { Character, DevilFruit, Weapon } from "@prisma/client";
import { deriveCombatant, CharacterStatsInput } from "../engine/character-stats";
import { parseFruitEffects } from "../engine/fruits";
import { Combatant } from "../engine/combat";

export type CharacterWithGear = Character & {
  devilFruit: DevilFruit | null;
  equippedWeapon: Weapon | null;
};

/** How awakened a character's fruit is — v1 ties it directly to level, a cheap proxy until a dedicated awakening quest exists. */
export function isFruitAwakened(character: Character): boolean {
  return character.level >= 40;
}

export function toCombatant(character: CharacterWithGear): Combatant {
  const input: CharacterStatsInput = {
    name: character.name,
    strength: character.strength,
    agility: character.agility,
    durability: character.durability,
    hp: character.hp,
    maxHp: character.maxHp,
    armamentHaki: character.armamentHaki,
    observationHaki: character.observationHaki,
    conquerorsHaki: character.conquerorsHaki,
    weaponAtkBonus: character.equippedWeapon?.atkBonus ?? 0,
    fruitEffects: character.devilFruit ? parseFruitEffects(character.devilFruit.effectsJson) : null,
    fruitAwakened: isFruitAwakened(character),
  };
  return deriveCombatant(input);
}

/**
 * General-purpose "how competent are you at this" modifier for non-combat
 * skill checks (exploring, haggling, sneaking, training). Combat uses the
 * full Combatant stats instead; this is deliberately coarser.
 */
export function generalSkillModifier(character: Character): number {
  const statAvg = (character.strength + character.agility + character.durability + character.willpower + character.intellect) / 5;
  return Math.round(statAvg + character.level * 2 + character.observationHaki * 0.1);
}
