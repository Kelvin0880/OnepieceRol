import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { npcState, parseList } from "@/lib/engine/island-npc";
import { engagedNpcIds } from "@/lib/game/island-npcs";

/** Public codex of the filler cast of every island, with their live state (free, fighting, hurt, arrested, dead). */
export async function GET() {
  const [rows, islands, engaged] = await Promise.all([
    prisma.islandNpc.findMany({ orderBy: [{ name: "asc" }] }),
    prisma.island.findMany({ select: { id: true, name: true, dangerLevel: true } }),
    engagedNpcIds(),
  ]);
  const island = new Map(islands.map((i) => [i.id, i]));
  const now = new Date();
  return NextResponse.json({
    residents: rows.map((n) => {
      const st = npcState(n, now, engaged);
      return {
        id: n.id,
        name: n.name,
        island: island.get(n.islandId)?.name ?? "?",
        title: n.title,
        category: n.category,
        level: n.level,
        description: n.description,
        personality: n.personality,
        weapon: n.weapon,
        abilities: parseList(n.abilitiesJson),
        memory: parseList(n.memoryJson).slice(-4),
        status: n.status,
        state: st.label,
        usable: st.usable,
        diedNote: n.diedNote,
        generation: n.generation,
      };
    }),
  });
}
