import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { factionTitle, type FactionKey } from "@/lib/engine/progression";

/**
 * Public registry of every player character ever created and still on record (alive, imprisoned or dead). Only what the
 * world could plainly know: no account names, no exact position of someone at sea, nothing private.
 */
export async function GET() {
  const rows = await prisma.character.findMany({
    select: {
      id: true,
      name: true,
      faction: true,
      level: true,
      title: true,
      bounty: true,
      notoriety: true,
      status: true,
      createdAt: true,
      diedAt: true,
      deathCause: true,
      voyageToIslandId: true,
      voyageArrivesAt: true,
      currentIsland: { select: { name: true } },
      devilFruit: { select: { name: true } },
      crew: { select: { name: true } },
    },
    orderBy: [{ level: "desc" }, { createdAt: "asc" }],
    take: 500,
  });
  const now = Date.now();
  return NextResponse.json({
    players: rows.map((c) => {
      const atSea = !!c.voyageToIslandId && !!c.voyageArrivesAt && c.voyageArrivesAt.getTime() > now;
      return {
        id: c.id,
        name: c.name,
        faction: c.faction,
        rank: factionTitle(c.faction as FactionKey, c.bounty, c.notoriety),
        title: c.title,
        level: c.level,
        bounty: c.faction === "PIRATE" ? c.bounty : null,
        notoriety: c.faction !== "PIRATE" ? c.notoriety : null,
        status: c.status,
        location: c.status === "DEAD" ? null : atSea ? "En el mar" : c.currentIsland.name,
        fruit: c.devilFruit?.name ?? null,
        crew: c.crew?.name ?? null,
        joinedAt: c.createdAt,
        diedAt: c.diedAt,
        deathCause: c.status === "DEAD" ? c.deathCause : null,
      };
    }),
  });
}
