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
}

/**
 * Turns a character's raw sheet into the flat atk/def/spd a combat round
 * consumes. Kept separate from the Prisma model so it's trivial to unit
 * test without a database.
 */
export function deriveCombatant(input: CharacterStatsInput): Combatant {
  const fruitMod = fruitCombatModifier(input.fruitEffects, input.fruitAwakened);

  const armamentBonus = Math.round(input.armamentHaki * 0.3);
  const observationBonus = Math.round(input.observationHaki * 0.15); // read attacks coming -> effectively more def
  const conquerorBonus = input.conquerorsHaki ? 8 : 0;

  return {
    name: input.name,
    hp: input.hp,
    maxHp: input.maxHp,
    atk: input.strength + input.weaponAtkBonus + fruitMod.atk + armamentBonus + conquerorBonus,
    def: Math.round(input.durability * 0.8) + fruitMod.def + observationBonus,
    spd: input.agility + fruitMod.spd,
  };
}
