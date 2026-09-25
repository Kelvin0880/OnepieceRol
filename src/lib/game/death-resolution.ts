import { prisma } from "../db";
import { judgeFate } from "../ai/judge";
import { CharacterStatus } from "@prisma/client";

export async function postNews(
  headline: string,
  body: string,
  category: string,
  characterId?: string,
  severity: "normal" | "digest" | "major" = "normal",
  where?: { locationName?: string; islandId?: string }
) {
  // Every headline says where it happened: default to the island the character is on right now.
  let locationName = where?.locationName;
  let islandId = where?.islandId;
  if (!locationName && characterId) {
    const c = await prisma.character.findUnique({ where: { id: characterId }, select: { currentIslandId: true, currentIsland: { select: { name: true } } } });
    if (c) {
      locationName = c.currentIsland.name;
      islandId = c.currentIslandId;
    }
  }
  await prisma.newsItem.create({ data: { headline, body, category, characterId, severity, locationName: locationName ?? "Ubicación desconocida", islandId } });
}

export interface DeathCheckCharacter {
  id: string;
  name: string;
  level: number;
  maxHp: number;
  durability: number;
  willpower: number;
  currentIsland: { name: string; dangerLevel: number };
  companions?: { id: string; status: string; name?: string }[];
  /** Needed only when the fall may end in a capture. */
  faction?: string;
  bounty?: number;
  notoriety?: number;
  currentIslandId?: string;
  devilFruitId?: string | null;
}

export interface FallenBy {
  name: string;
  personality?: string;
  faction?: string;
  isBoss?: boolean;
  /** Combat power of the victor, used if the fall ends in a capture. */
  power?: number;
}

/**
 * Shared by solo combat, group fights and sieges: what happens to someone who reaches 0 HP. The AI judge decides
 * (game/../ai/judge.ts judgeFate) from who beat them, where and why: death is permanent, capture puts them in
 * prison, and otherwise they survive badly hurt. Nothing is rolled; if no judge answers, nobody dies.
 */
export async function handleDeathCheck(
  character: DeathCheckCharacter,
  survivedHp: number,
  cause: string,
  newsLog: string[],
  by?: FallenBy
): Promise<{ died: boolean; captured?: boolean; finalHp: number }> {
  if (survivedHp > 0) return { died: false, finalHp: survivedHp };

  const alive = (character.companions ?? []).filter((c) => c.status === "ALIVE");
  const verdict = await judgeFate({
    victim: { name: character.name, level: character.level, durability: character.durability, willpower: character.willpower, faction: character.faction ?? "PIRATE", bounty: character.bounty },
    cause,
    killer: by,
    islandName: character.currentIsland.name,
    islandDanger: character.currentIsland.dangerLevel,
    companions: alive.map((c) => c.name).filter((n): n is string => !!n),
    characterId: character.id,
  });

  if (verdict.fate === "death") {
    await prisma.character.update({
      where: { id: character.id },
      data: { status: CharacterStatus.DEAD, hp: 0, deathCause: cause, diedAt: new Date() },
    });
    const headline = `${character.name} ha caído en ${character.currentIsland.name}`;
    await postNews(headline, `${cause} Su leyenda termina aquí, en las aguas donde tantos otros también se quedaron.`, "Muertes", character.id, "major");
    newsLog.push(headline);

    const lost = new Set(verdict.companionsLost.map((n) => n.toLowerCase()));
    for (const companion of alive) {
      if (companion.name && lost.has(companion.name.toLowerCase())) {
        await prisma.nPCCompanion.update({
          where: { id: companion.id },
          data: { status: CharacterStatus.DEAD, deathCause: "Caído defendiendo a su capitán.", diedAt: new Date() },
        });
      }
    }
    return { died: true, finalHp: 0 };
  }

  if (verdict.fate === "captured" && character.currentIslandId && character.faction) {
    const { captureCharacter } = await import("./prison"); // dynamic: prison.ts imports postNews from this file
    await captureCharacter(
      { id: character.id, name: character.name, maxHp: character.maxHp, currentIslandId: character.currentIslandId, currentIsland: character.currentIsland, level: character.level, devilFruitId: character.devilFruitId, faction: character.faction, bounty: character.bounty, notoriety: character.notoriety },
      by?.power ?? character.level * 12,
      `${cause} Fue apresado.`,
      newsLog
    );
    return { died: false, captured: true, finalHp: Math.max(1, Math.round(character.maxHp * 0.15)) };
  }

  return { died: false, finalHp: Math.max(5, Math.round(character.maxHp * 0.1)) };
}
