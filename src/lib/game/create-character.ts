import { prisma } from "../db";
import { Faction, WeaponGrade } from "@prisma/client";
import { findCommonWeapon } from "./common-gear";

export const ARCHETYPES = [
  {
    id: "swordsman",
    name: "Espadachín",
    description: "Ágil y letal con la hoja en la mano. Prospera en duelos rápidos.",
    stats: { strength: 8, agility: 9, durability: 6, willpower: 5, intellect: 4 },
    starterWeaponName: "Espada de acero",
  },
  {
    id: "brawler",
    name: "Luchador Cuerpo a Cuerpo",
    description: "Puños de acero y un cuerpo que absorbe castigo sin quebrarse.",
    stats: { strength: 9, agility: 6, durability: 9, willpower: 5, intellect: 3 },
    starterWeaponName: "Nudillos de hierro",
  },
  {
    id: "marksman",
    name: "Tirador",
    description: "Frío, calculador, y letal a distancia antes de que el enemigo reaccione.",
    stats: { strength: 5, agility: 8, durability: 5, willpower: 5, intellect: 9 },
    starterWeaponName: "Pistola de chispa",
  },
  {
    id: "brawn",
    name: "Fuerza Bruta",
    description: "Lento pero devastador. Lo que golpea, no se vuelve a levantar.",
    stats: { strength: 10, agility: 4, durability: 10, willpower: 4, intellect: 4 },
    starterWeaponName: "Hacha de leñador",
  },
] as const;

export type ArchetypeId = (typeof ARCHETYPES)[number]["id"];

const STARTING_ISLAND_BY_FACTION: Record<Faction, string> = {
  PIRATE: "Pueblo Foosha",
  MARINE: "Cuartel Marine G-5",
  REVOLUTIONARY: "Isla Baltigo",
  BOUNTY_HUNTER: "Isla Gecko",
};

export class CharacterCreationError extends Error {}

export async function createCharacter(userId: string, name: string, faction: Faction, archetypeId: ArchetypeId) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 24) {
    throw new CharacterCreationError("El nombre debe tener entre 2 y 24 caracteres.");
  }

  const archetype = ARCHETYPES.find((a) => a.id === archetypeId);
  if (!archetype) throw new CharacterCreationError("Arquetipo desconocido.");

  const islandName = STARTING_ISLAND_BY_FACTION[faction];
  const island = await prisma.island.findUnique({ where: { name: islandName } });
  if (!island) throw new CharacterCreationError("El mundo aún no está sembrado — falta ejecutar el seed.");

  const starterWeaponSpec = findCommonWeapon(archetype.starterWeaponName);

  const character = await prisma.character.create({
    data: {
      name: trimmed,
      faction,
      userId,
      ...archetype.stats,
      currentIslandId: island.id,
      isCaptain: true,
      islandsVisited: JSON.stringify([island.id]),
    },
  });

  if (starterWeaponSpec) {
    const weapon = await prisma.weapon.create({
      data: {
        name: starterWeaponSpec.name,
        kind: starterWeaponSpec.kind,
        grade: WeaponGrade.NONE,
        description: starterWeaponSpec.description,
        atkBonus: starterWeaponSpec.atkBonus,
        basePrice: starterWeaponSpec.basePrice,
        ownerId: character.id,
      },
    });
    await prisma.character.update({ where: { id: character.id }, data: { equippedWeaponId: weapon.id } });
  }

  await prisma.gameLogEntry.create({
    data: {
      characterId: character.id,
      kind: "genesis",
      text: `${trimmed} pone un pie en ${island.name}, con nada más que ${archetype.starterWeaponName.toLowerCase()} y la determinación de escribir su propia leyenda.`,
    },
  });

  return character;
}
