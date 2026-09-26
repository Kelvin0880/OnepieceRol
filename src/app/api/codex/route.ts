import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { whereLabel } from "@/lib/engine/actor-movement";
import { prisonLabel } from "@/lib/engine/world-state";
import { actorStyleNames } from "@/lib/engine/actor-styles";

/** Public codex of the canon cast. A character moving in secret never reveals where they are. */
export async function GET() {
  const [actors, islands] = await Promise.all([
    prisma.worldActor.findMany({ include: { devilFruit: { select: { name: true, englishName: true, type: true, rarity: true } } }, orderBy: [{ powerLevel: "desc" }, { name: "asc" }] }),
    prisma.island.findMany({ select: { id: true, name: true } }),
  ]);
  const islandName = new Map(islands.map((i) => [i.id, i.name]));
  const whereOf = (a: (typeof actors)[number]) =>
    whereLabel({
      hidden: a.locationHidden,
      kind: a.locationKind,
      islandName: a.currentIslandId ? islandName.get(a.currentIslandId) : null,
      seaFromName: a.seaFromIslandId ? islandName.get(a.seaFromIslandId) : null,
      seaToName: a.seaToIslandId ? islandName.get(a.seaToIslandId) : null,
    });
  return NextResponse.json({
    actors: actors.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      rankLabel: a.rankLabel,
      factionType: a.factionType,
      factionName: a.factionName,
      status: a.status,
      powerLevel: a.powerLevel,
      description: a.description,
      personality: a.personality,
      canonBounty: a.canonBounty != null ? a.canonBounty.toString() : null,
      canonWeapon: a.canonWeapon,
      devilFruit: a.devilFruit,
      stats: a.statsJson ? JSON.parse(a.statsJson) : null,
      abilities: a.abilitiesJson ? (JSON.parse(a.abilitiesJson) as string[]) : [],
      styles: actorStyleNames(a.name),
      home: a.homeIslandId ? islandName.get(a.homeIslandId) ?? null : null,
      location: a.status === "ACTIVE" ? whereOf(a).name : a.status === "CAPTURED" ? prisonLabel(a.prisonLevel) : null,
      locationKind: a.status === "ACTIVE" ? whereOf(a).kind : a.status === "CAPTURED" ? "prison" : null,
      prisonLevel: a.status === "CAPTURED" ? a.prisonLevel : null,
      capturedAt: a.status === "CAPTURED" ? a.capturedAt : null,
      focus: a.status === "ACTIVE" ? a.currentFocus : null,
    })),
  });
}
