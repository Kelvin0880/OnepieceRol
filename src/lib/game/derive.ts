import { Character, DevilFruit, Weapon } from "@prisma/client";
import { deriveCombatant, CharacterStatsInput } from "../engine/character-stats";
import { parseFruitEffects } from "../engine/fruits";
import { Combatant } from "../engine/combat";
import { fruitPhase, fruitPowerMultiplier, FruitPhase } from "../engine/fruit-mastery";

export type CharacterWithGear = Character & {
  devilFruit: DevilFruit | null;
  equippedWeapon: Weapon | null;
};

export function characterFruitPhase(character: Character): FruitPhase {
  return fruitPhase(character.fruitMastery, character.fruitAwakened);
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
    fruitAwakened: character.fruitAwakened,
    fruitPower: fruitPowerMultiplier(characterFruitPhase(character)),
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
