import { FruitType, Rarity } from "@prisma/client";
import type { DevilFruitCatalogEntry } from "./devil-fruit-catalog";

type RarityKey = keyof typeof Rarity;

/** Compact constructor for the fruit data files: every fruit is name, English name, rarity, description and its combat numbers. */
export function fruitMaker(type: FruitType) {
  return (
    name: string,
    englishName: string,
    rarity: RarityKey,
    description: string,
    category: "offensive" | "defensive" | "mobility" | "utility" | "transformation" | "control",
    atk: number,
    def: number,
    spd: number,
    opts: { singleton?: boolean; element?: string; awakened?: string } = {}
  ): DevilFruitCatalogEntry => ({
    name,
    englishName,
    type,
    rarity: Rarity[rarity],
    description,
    effects: {
      category,
      ...(opts.element ? { element: opts.element } : {}),
      atk,
      def,
      spd,
      ...(type === FruitType.LOGIA ? { logiaIntangible: true } : {}),
      ...(opts.awakened ? { awakened: { atk: Math.max(4, Math.round(atk / 2)), note: opts.awakened } } : {}),
    },
    isSingleton: opts.singleton ?? false,
  });
}
