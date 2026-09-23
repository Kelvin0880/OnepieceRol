/**
 * Devil fruit effects are stored as JSON on DevilFruit.effectsJson so new
 * fruits are pure data (seed content), never new branches of engine code.
 */
export interface FruitEffects {
  category: "offensive" | "defensive" | "mobility" | "utility" | "transformation";
  element?: string; // flavor text: "fuego", "hielo", "magma", "oscuridad", "luz", "terremoto"...
  atk?: number;
  def?: number;
  spd?: number;
  logiaIntangible?: boolean; // immune to non-Haki, non-elemental physical damage
  awakened?: {
    atk?: number;
    def?: number;
    spd?: number;
    note?: string;
  };
}

export function parseFruitEffects(effectsJson: string): FruitEffects {
  const parsed = JSON.parse(effectsJson) as FruitEffects;
  return parsed;
}

export function serializeFruitEffects(effects: FruitEffects): string {
  return JSON.stringify(effects);
}

/** Net combat modifier contributed by a devil fruit, awakening included. */
export function fruitCombatModifier(
  effects: FruitEffects | null,
  awakened: boolean
): { atk: number; def: number; spd: number } {
  if (!effects) return { atk: 0, def: 0, spd: 0 };
  const atk = (effects.atk ?? 0) + (awakened ? effects.awakened?.atk ?? 0 : 0);
  const def = (effects.def ?? 0) + (awakened ? effects.awakened?.def ?? 0 : 0);
  const spd = (effects.spd ?? 0) + (awakened ? effects.awakened?.spd ?? 0 : 0);
  return { atk, def, spd };
}
