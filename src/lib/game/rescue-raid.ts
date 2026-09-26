import { prisma } from "../db";
import { actorCombatStats } from "../engine/guardian";
import { rescueBlockReason, rescueRequirement, rescueRewards } from "../engine/rescue-raid";
import { prisonLabel } from "../engine/world-state";
import { postNews } from "./death-resolution";
import { invalidateWorldState } from "./world-state";
import { startJointFight, freePartyMemberIds, getOpenJointFightFor, JointFightError } from "./joint-fight";

export class RescueRaidError extends Error {}

/** The canon prisoners of Impel Down, for whoever stands on that island: what a rescue asks and whether this group can try. */
export async function getRescueRaidState(characterId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me || me.currentIsland.name !== "Impel Down" || me.status !== "ALIVE") return null;
  const groupIds = await freePartyMemberIds(me.id);
  const group = await prisma.character.findMany({ where: { id: { in: groupIds }, currentIslandId: me.currentIslandId }, select: { level: true } });
  const held = await prisma.worldActor.findMany({ where: { status: "CAPTURED" }, orderBy: [{ prisonLevel: "desc" }, { name: "asc" }] });
  return {
    groupSize: group.length,
    prisoners: held.map((a) => {
      const cell = a.prisonLevel ?? 1;
      const req = rescueRequirement(cell);
      return { actorId: a.id, name: a.name, factionName: a.factionName, cell, place: prisonLabel(cell), minLevel: req.minLevel, minPeople: req.minPeople, blockReason: rescueBlockReason({ cell, levels: group.map((g) => g.level) }) };
    }),
  };
}

export async function startRescueRaid(characterId: string, userId: string, actorId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me || me.userId !== userId) throw new RescueRaidError("Personaje no encontrado.");
  if (me.status !== "ALIVE") throw new RescueRaidError("No estás en condiciones de luchar.");
  if (me.currentIsland.name !== "Impel Down") throw new RescueRaidError("Un rescate solo se lanza desde dentro de Impel Down.");
  if (await getOpenJointFightFor(me.id)) throw new RescueRaidError("Ya estás metido en una pelea.");
  const actor = await prisma.worldActor.findUnique({ where: { id: actorId } });
  if (!actor || actor.status !== "CAPTURED") throw new RescueRaidError("Ese preso ya no está encerrado.");
  const cell = actor.prisonLevel ?? 1;
  const ids = await freePartyMemberIds(me.id);
  const group = await prisma.character.findMany({ where: { id: { in: ids }, currentIslandId: me.currentIslandId, status: "ALIVE" } });
  const reason = rescueBlockReason({ cell, levels: group.map((g) => g.level) });
  if (reason) throw new RescueRaidError(reason);
  const req = rescueRequirement(cell);
  const stats = actorCombatStats(req.guardPower);
  try {
    const started = await startJointFight({
      kind: "rescue",
      characterIds: group.map((g) => g.id),
      enemy: { name: `Guardia mayor del ${prisonLabel(cell).replace("Impel Down, ", "")}`, ...stats, isBoss: true, personality: "Carcelero implacable de Impel Down: no deja salir a nadie" },
      rewards: rescueRewards(cell, req.guardPower),
      stakes: `Rescate de ${actor.name} en ${prisonLabel(cell)}. Si el guardia cae, el preso queda libre.`,
      context: { rescueActorId: actor.id },
    });
    return { log: [`Comienza el asalto para liberar a ${actor.name}. Todos describen su movimiento.`], fightId: started.fightId };
  } catch (err) {
    if (err instanceof JointFightError) throw new RescueRaidError(err.message);
    throw err;
  }
}

/** Called by joint-fight.ts when a rescue fight ends: a win frees the prisoner (alive, hidden, out of Impel Down). */
export async function handleRescueSettled(p: { contextJson: string; outcome: "victory" | "defeat" | null; humans: { characterId: string; status: string; name: string }[] }): Promise<string[]> {
  let ctx: { rescueActorId?: string } = {};
  try {
    ctx = JSON.parse(p.contextJson);
  } catch {
    return [];
  }
  if (!ctx.rescueActorId) return [];
  const actor = await prisma.worldActor.findUnique({ where: { id: ctx.rescueActorId } });
  if (!actor || actor.status !== "CAPTURED") return [];
  if (p.outcome !== "victory") return [`${actor.name} sigue encerrado: el asalto fracasó.`];
  const impel = await prisma.island.findUnique({ where: { name: "Impel Down" } });
  const rescuers = p.humans.filter((h) => h.status !== "FLED").map((h) => h.name);
  const neighbours = impel ? (JSON.parse(impel.connections) as string[]) : [];
  await prisma.worldActor.update({
    where: { id: actor.id },
    data: { status: "ACTIVE", prisonLevel: null, capturedAt: null, currentFocus: "Recién liberado de Impel Down", currentIslandId: neighbours[0] ?? actor.homeIslandId, locationKind: "island", locationHidden: true, seaFromIslandId: null, seaToIslandId: null, busyUntil: new Date(Date.now() + 12 * 3600_000), locationUpdatedAt: new Date() },
  });
  await postNews(
    `${actor.name} es liberado de Impel Down`,
    `${rescuers.join(", ")} irrumpieron en Impel Down, vencieron a la guardia y sacaron a ${actor.name} de su celda. Nadie sabe dónde se esconde ahora.`,
    "Guerra",
    undefined,
    "major",
    { locationName: "Impel Down", islandId: impel?.id }
  );
  invalidateWorldState();
  return [`¡${actor.name} es libre!`];
}
