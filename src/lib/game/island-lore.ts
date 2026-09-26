import { prisma } from "../db";
import { islandLoreBlock, placeNames, type IslandLore } from "../engine/island-lore";
import { ISLAND_LORE_DATA } from "./island-lore-data";

const BY_NAME = new Map(ISLAND_LORE_DATA.map((l) => [l.island, l]));

export function islandLore(islandName: string): IslandLore | null {
  return BY_NAME.get(islandName) ?? null;
}

/** Every named place of every island, so validators accept them as real names. */
export function allPlaceNames(): string[] {
  return ISLAND_LORE_DATA.flatMap((l) => placeNames(l));
}

/** The island's gazetteer plus the given characters' active missions there, ready for a narrator prompt. */
export async function islandBlockFor(islandId: string, characterIds: string[] = []): Promise<string> {
  const isle = await prisma.island.findUnique({ where: { id: islandId }, select: { name: true, description: true, arcHook: true, dangerLevel: true, factionControl: true } });
  if (!isle) return "";
  const missions = characterIds.length
    ? await prisma.mission.findMany({ where: { characterId: { in: characterIds }, islandId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { title: true, brief: true, progress: true, target: true, giverNpcId: true, targetNpcId: true } })
    : [];
  const npcIds = [...new Set(missions.flatMap((m) => [m.giverNpcId, m.targetNpcId]).filter((x): x is string => !!x))];
  const npcs = npcIds.length ? await prisma.islandNpc.findMany({ where: { id: { in: npcIds } }, select: { id: true, name: true } }) : [];
  const nameOf = (id: string | null) => (id ? npcs.find((n) => n.id === id)?.name ?? null : null);
  return islandLoreBlock({
    name: isle.name,
    description: isle.description,
    arcHook: isle.arcHook,
    danger: isle.dangerLevel,
    control: isle.factionControl,
    lore: islandLore(isle.name),
    missions: missions.map((m) => ({ title: m.title, brief: m.brief, progress: m.progress, target: m.target, giver: nameOf(m.giverNpcId), targetName: nameOf(m.targetNpcId) })),
  });
}
