import { Character, CharacterStyle, DevilFruit, Weapon } from "@prisma/client";
import { activeStyle, getStyle, passiveMods, wieldedAttackBonus } from "../engine/styles";
import { deriveCombatant, CharacterStatsInput } from "../engine/character-stats";
import { parseFruitEffects } from "../engine/fruits";
import { Combatant } from "../engine/combat";
import { fruitPhase, fruitPowerMultiplier, FruitPhase } from "../engine/fruit-mastery";

export type CharacterWithGear = Character & {
  devilFruit: DevilFruit | null;
  equippedWeapon: Weapon | null;
  /** Optional: load `styles: true` and `ownedWeapons: { where: { wielded: true } }` to count combat styles and off-hand weapons. */
  styles?: CharacterStyle[];
  ownedWeapons?: Weapon[];
};

export function characterFruitPhase(character: Character): FruitPhase {
  return fruitPhase(character.fruitMastery, character.fruitAwakened);
}

/** Main weapon first, then the off-hand ones (never more than 3 in total, never the main one twice). */
export function wieldedWeapons(character: CharacterWithGear): Weapon[] {
  const main = character.equippedWeapon;
  const extras = (character.ownedWeapons ?? []).filter((w) => w.wielded && w.id !== main?.id);
  return [...(main ? [main] : []), ...extras].slice(0, 3);
}

export function toCombatant(character: CharacterWithGear): Combatant {
  const wielded = wieldedWeapons(character);
  const known = (character.styles ?? []).map((s) => ({ id: s.styleId, mastery: s.mastery }));
  const style = activeStyle(known, wielded.length, character.styleFocusId);
  // A multi-blade style makes the extra weapons count; without one they are clumsy.
  const slots = style && style.def.weapons.min > 1 ? style.def.weapons.min : 1;
  const weaponBonus = wieldedAttackBonus(wielded.map((w) => w.atkBonus), slots, style?.mastery ?? 0);
  const passive = style ? passiveMods(style.def, style.mastery) : null;
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
    weaponAtkBonus: weaponBonus,
    fruitEffects: character.devilFruit ? parseFruitEffects(character.devilFruit.effectsJson) : null,
    fruitAwakened: character.fruitAwakened,
    fruitPower: fruitPowerMultiplier(characterFruitPhase(character)),
    level: character.level,
  };
  const base = deriveCombatant(input);
  if (!passive) return base;
  return { ...base, atk: base.atk + passive.atk, def: base.def + passive.def, spd: base.spd + passive.spd, ...(passive.pierce > 0 ? { pierce: passive.pierce } : {}) };
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
