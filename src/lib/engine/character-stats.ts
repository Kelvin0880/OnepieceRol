import { Combatant } from "./combat";
import { FruitEffects, fruitCombatModifier } from "./fruits";

export interface CharacterStatsInput {
  name: string;
  strength: number;
  agility: number;
  durability: number;
  hp: number;
  maxHp: number;
  armamentHaki: number; // 0-100
  observationHaki: number; // 0-100
  conquerorsHaki: boolean;
  weaponAtkBonus: number;
  fruitEffects: FruitEffects | null;
  fruitAwakened: boolean;
  /** Phase multiplier on the fruit's bonuses (fruit-mastery.ts). Defaults to 1 for callers that don't track mastery. */
  fruitPower?: number;
}

/**
 * Turns a character's raw sheet into the flat atk/def/spd a combat round
 * consumes. Kept separate from the Prisma model so it's trivial to unit
 * test without a database.
 *
 * Haki and the fruit contribute only their *passive* half here (always on);
 * the rest is earned by actively using them in an exchange (techniques.ts),
 * which is what makes describing "I use armament haki" matter.
 */
export function deriveCombatant(input: CharacterStatsInput): Combatant {
  const fruitMod = fruitCombatModifier(input.fruitEffects, input.fruitAwakened);
  const fruitScale = (input.fruitPower ?? 1) * 0.5;

  const armamentBonus = Math.round(input.armamentHaki * 0.15);
  const observationBonus = Math.round(input.observationHaki * 0.08); // read attacks coming -> effectively more def
  const conquerorBonus = input.conquerorsHaki ? 3 : 0;

  return {
    name: input.name,
    hp: input.hp,
    maxHp: input.maxHp,
    atk: input.strength + input.weaponAtkBonus + Math.round(fruitMod.atk * fruitScale) + armamentBonus + conquerorBonus,
    def: Math.round(input.durability * 0.8) + Math.round(fruitMod.def * fruitScale) + observationBonus,
    spd: input.agility + Math.round(fruitMod.spd * fruitScale),
  };
}
