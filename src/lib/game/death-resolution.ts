import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { rollDeath } from "../engine/death";
import { CharacterStatus } from "@prisma/client";

export async function postNews(headline: string, body: string, category: string, characterId?: string, severity: "normal" | "digest" | "major" = "normal") {
  await prisma.newsItem.create({ data: { headline, body, category, characterId, severity } });
}

export interface DeathCheckCharacter {
  id: string;
  name: string;
  level: number;
  maxHp: number;
  durability: number;
  willpower: number;
  currentIsland: { name: string; dangerLevel: number };
  companions?: { id: string; status: string }[];
}

/**
 * Shared by solo combat and group battles: rolled whenever a character's HP
 * hits 0. Never a guaranteed death (even at max risk there's a floor), and
 * never risk-free — this is the one place permadeath actually happens.
 */
export async function handleDeathCheck(
  character: DeathCheckCharacter,
  survivedHp: number,
  cause: string,
  newsLog: string[]
): Promise<{ died: boolean; finalHp: number }> {
  if (survivedHp > 0) return { died: false, finalHp: survivedHp };

  const roll = rollDeath(liveRng(), {
    islandDanger: character.currentIsland.dangerLevel,
    characterLevel: character.level,
    durability: character.durability,
    willpower: character.willpower,
    permadeath: true,
  });

  if (roll.died) {
    await prisma.character.update({
      where: { id: character.id },
      data: { status: CharacterStatus.DEAD, hp: 0, deathCause: cause, diedAt: new Date() },
    });
    const headline = `${character.name} ha caído en ${character.currentIsland.name}`;
    await postNews(headline, `${cause} Su leyenda termina aquí, en las aguas donde tantos otros también se quedaron.`, "Muertes", character.id, "major");
    newsLog.push(headline);

    for (const companion of character.companions?.filter((c) => c.status === "ALIVE") ?? []) {
      if (Math.random() < 0.3) {
        await prisma.nPCCompanion.update({
          where: { id: companion.id },
          data: { status: CharacterStatus.DEAD, deathCause: "Caído defendiendo a su capitán.", diedAt: new Date() },
        });
      }
    }
    return { died: true, finalHp: 0 };
  }

  return { died: false, finalHp: Math.max(5, Math.round(character.maxHp * 0.1)) };
}
