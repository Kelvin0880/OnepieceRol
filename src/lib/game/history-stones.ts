import type { PrismaClient } from "@prisma/client";
import { HISTORY_CHAPTERS } from "../engine/poneglyph-lore";

/** Places the Historia Poneglyphs on their islands. Idempotent: safe on a live world, never touches anyone's reads. */
export async function seedHistoryStones(db: PrismaClient): Promise<number> {
  let placed = 0;
  for (const ch of HISTORY_CHAPTERS) {
    const island = await db.island.findUnique({ where: { name: ch.islandName } });
    if (!island) continue;
    await db.poneglyph.upsert({
      where: { codeName: ch.codeName },
      update: { kind: "Historia", loreText: ch.text, locationIslandId: island.id },
      create: { codeName: ch.codeName, kind: "Historia", loreText: ch.text, guardedBy: null, locationIslandId: island.id },
    });
    placed++;
  }
  return placed;
}
