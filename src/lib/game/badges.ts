import { prisma } from "../db";
import { channelFor, crewChannelKey } from "../engine/denden";

export interface BadgeCounts {
  now: number;
  news: number;
  denden: number;
  events: number;
  /** Names of everything in the bag and in hand: the client compares them with what it saw last time. */
  inventory: string[];
}

const dateOf = (ms: number | null) => new Date(ms !== null && Number.isFinite(ms) && ms > 0 ? ms : Date.now());

/**
 * "Something new" counters for the header buttons. The client keeps the last time it looked at each section (localStorage),
 * so nothing is stored per player on the server; the counts only ever cover what the character could see anyway.
 */
export async function getBadges(characterId: string, userId: string, since: { news: number | null; denden: number | null; events: number | null }): Promise<BadgeCounts> {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { userId: true, faction: true, crewId: true } });
  if (!c || c.userId !== userId) throw new Error("Personaje no encontrado.");
  const channels = [channelFor(c.faction), ...(c.crewId ? [crewChannelKey(c.crewId)] : [])];
  const [news, denden, events, items, weapons] = await Promise.all([
    prisma.newsItem.count({ where: { createdAt: { gt: dateOf(since.news) } } }),
    prisma.denDenMessage.count({ where: { faction: { in: channels }, authorCharacterId: { not: characterId }, createdAt: { gt: dateOf(since.denden) } } }),
    prisma.playerEvent.count({ where: { status: "OPEN", createdAt: { gt: dateOf(since.events) } } }),
    prisma.inventoryItem.findMany({ where: { characterId }, select: { name: true } }),
    prisma.weapon.findMany({ where: { ownerId: characterId }, select: { name: true } }),
  ]);
  return { now: Date.now(), news, denden, events, inventory: [...new Set([...items.map((i) => i.name), ...weapons.map((w) => w.name)])] };
}
