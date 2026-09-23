import { prisma } from "../db";
import { standingAfterMission, standingAfterMercy } from "../engine/raid";

/** Raises how much a WorldActor trusts a character; only ever grows through good deeds, never decays. */
export async function addStanding(worldActorId: string, characterId: string, kind: { mission: number } | { mercy: true }, note: string): Promise<number> {
  const row = await prisma.alliance.findUnique({ where: { worldActorId_characterId: { worldActorId, characterId } } });
  const current = row?.standing ?? 0;
  const standing = "mission" in kind ? standingAfterMission(current, kind.mission) : standingAfterMercy(current);
  await prisma.alliance.upsert({
    where: { worldActorId_characterId: { worldActorId, characterId } },
    create: { worldActorId, characterId, standing, lastNote: note },
    update: { standing, lastNote: note },
  });
  return standing;
}

export async function standingsFor(characterId: string) {
  const rows = await prisma.alliance.findMany({ where: { characterId, standing: { gt: 0 } } });
  if (rows.length === 0) return [];
  const actors = await prisma.worldActor.findMany({ where: { id: { in: rows.map((r) => r.worldActorId) } } });
  const byId = new Map(actors.map((a) => [a.id, a]));
  return rows
    .map((r) => ({ actorId: r.worldActorId, name: byId.get(r.worldActorId)?.name ?? "?", standing: r.standing, note: r.lastNote, powerLevel: byId.get(r.worldActorId)?.powerLevel ?? 0 }))
    .sort((a, b) => b.standing - a.standing);
}
