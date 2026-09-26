import { prisma } from "../db";
import { varietyRng } from "../engine/rng";
import {
  admiralOpening,
  dispatchPhase,
  dispatchTravelMs,
  isDispatchTarget,
  islandProtectedFromDispatch,
  pickDispatchTarget,
  shouldStartDispatch,
} from "../engine/admiral-dispatch";
import { actorCombatStats } from "../engine/guardian";
import { postNews } from "./death-resolution";
import { notifyIsland } from "./notify";
import { invalidateWorldState } from "./world-state";
import { startJointFight, getOpenJointFightFor, JointFightError } from "./joint-fight";
import { getOpenDuelFor } from "./duel";
import { logError } from "../log-error";
import type { AdmiralDispatch } from "@prisma/client";

export class DispatchError extends Error {}

const OPEN = ["EN_ROUTE", "ARRIVED", "RETURNING"];
const inFlight = new Set<string>();

async function graph(): Promise<Map<string, { name: string; neighbors: string[] }>> {
  const islands = await prisma.island.findMany({ select: { id: true, name: true, connections: true } });
  return new Map(islands.map((i) => [i.id, { name: i.name, neighbors: JSON.parse(i.connections) as string[] }]));
}

function hopsBetween(g: Awaited<ReturnType<typeof graph>>, from: string | null, to: string): number {
  if (!from) return 5;
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; d <= 30 && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) for (const n of g.get(id)?.neighbors ?? []) if (!seen.has(n)) {
      if (n === to) return d;
      seen.add(n);
      next.push(n);
    }
    frontier = next;
  }
  return 12;
}

/** Islands with at least one hunted pirate player and no protection, with the count of players standing there. */
async function huntableIslands(): Promise<{ id: string; targets: number }[]> {
  const [players, islands, territories, actors] = await Promise.all([
    prisma.character.findMany({ where: { status: "ALIVE", faction: "PIRATE", level: { gte: 2 } }, select: { currentIslandId: true, faction: true, level: true, status: true } }),
    prisma.island.findMany({ select: { id: true, name: true, factionControl: true } }),
    prisma.territory.findMany({ select: { islandId: true, ownerActorId: true, ownerCharacterId: true, ownerCrewId: true } }),
    prisma.worldActor.findMany({ select: { id: true, factionType: true } }),
  ]);
  const count = new Map<string, number>();
  for (const p of players) if (isDispatchTarget(p)) count.set(p.currentIslandId, (count.get(p.currentIslandId) ?? 0) + 1);
  return islands
    .filter((i) => {
      const t = territories.find((x) => x.islandId === i.id);
      const ownerFaction = t?.ownerActorId ? actors.find((a) => a.id === t.ownerActorId)?.factionType ?? null : null;
      return !islandProtectedFromDispatch({ name: i.name, factionControl: i.factionControl, ownerFaction, ownedByPlayer: !!(t?.ownerCharacterId || t?.ownerCrewId) });
    })
    .map((i) => ({ id: i.id, targets: count.get(i.id) ?? 0 }));
}

export interface StartDispatchOpts {
  admiralName?: string;
  islandId?: string;
  minutes?: number;
  /** The owner's manual launch skips the randomness and the cooldown, never the protections. */
  manual?: boolean;
}

/** Sends an admiral. Returns null when there is nobody to hunt, no admiral free, or one is already out. */
export async function startDispatch(opts: StartDispatchOpts = {}): Promise<AdmiralDispatch | null> {
  if (await prisma.admiralDispatch.findFirst({ where: { status: { in: OPEN } }, select: { id: true } })) {
    if (opts.manual) throw new DispatchError("Ya hay un almirante en camino o atacando: espera a que termine.");
    return null;
  }
  const g = await graph();
  const huntable = await huntableIslands();
  const rng = varietyRng(`dispatch:${Math.floor(Date.now() / 60_000)}`);
  const targetId = opts.islandId ?? pickDispatchTarget(rng, huntable);
  if (!targetId) {
    if (opts.manual) throw new DispatchError("No hay ninguna isla atacable con piratas de nivel 2+.");
    return null;
  }
  const targetInfo = huntable.find((h) => h.id === targetId);
  if (!targetInfo) throw new DispatchError("Esa isla está protegida: las islas de inicio, revolucionarias y piratas nunca son atacadas.");
  const now = new Date();
  const admirals = await prisma.worldActor.findMany({ where: { role: "ADMIRAL", status: "ACTIVE", OR: [{ busyUntil: null }, { busyUntil: { lt: now } }] } });
  const admiral = opts.admiralName ? admirals.find((a) => a.name === opts.admiralName) : admirals[Math.floor(rng() * admirals.length)];
  if (!admiral) {
    if (opts.manual) throw new DispatchError(opts.admiralName ? `${opts.admiralName} no está disponible.` : "No hay ningún almirante libre.");
    return null;
  }
  const origin = admiral.currentIslandId ?? admiral.homeIslandId ?? null;
  const travelMs = opts.minutes ? Math.max(60_000, Math.round(opts.minutes * 60_000)) : dispatchTravelMs(hopsBetween(g, origin, targetId));
  const targetName = g.get(targetId)?.name ?? "una isla";
  const d = await prisma.admiralDispatch.create({
    data: { admiralActorId: admiral.id, admiralName: admiral.name, originIslandId: origin, targetIslandId: targetId, targetIslandName: targetName, travelMs, arrivesAt: new Date(now.getTime() + travelMs) },
  });
  await prisma.worldActor.update({
    where: { id: admiral.id },
    data: { currentFocus: `Navega hacia ${targetName} para erradicar a los piratas`, busyUntil: new Date(now.getTime() + travelMs * 3), locationHidden: false, locationKind: origin ? "sea" : "island", seaFromIslandId: origin, seaToIslandId: targetId, currentIslandId: origin ? null : admiral.currentIslandId, locationUpdatedAt: now },
  });
  const minutesTxt = Math.round(travelMs / 60_000);
  await postNews(
    `El almirante ${admiral.name} zarpa hacia ${targetName}`,
    `El Gobierno Mundial ha ordenado a ${admiral.name} erradicar a los piratas de ${targetName}. Llegará en unos ${minutesTxt} minutos. Quien no quiera enfrentarse a él, que abandone la isla antes de que desembarque: después no habrá escapatoria.`,
    "Gobierno Mundial",
    undefined,
    "major",
    { locationName: `En el mar, rumbo a ${targetName}`, islandId: targetId }
  );
  invalidateWorldState();
  await notifyIsland(targetId, "admiral-dispatch");
  return d;
}

async function returnHome(d: AdmiralDispatch, why: string) {
  const now = new Date();
  const returnsAt = new Date(now.getTime() + d.travelMs);
  await prisma.admiralDispatch.update({ where: { id: d.id }, data: { status: "RETURNING", returnsAt } });
  await prisma.worldActor.update({
    where: { id: d.admiralActorId },
    data: { currentFocus: `Regresa de ${d.targetIslandName}`, locationKind: d.originIslandId ? "sea" : "island", seaFromIslandId: d.targetIslandId, seaToIslandId: d.originIslandId, currentIslandId: d.originIslandId ? null : undefined, busyUntil: new Date(returnsAt.getTime() + 60_000), locationUpdatedAt: now },
  });
  await postNews(`${d.admiralName} regresa de ${d.targetIslandName}`, `${why} Tardará en volver a su puesto el mismo tiempo que le costó llegar.`, "Gobierno Mundial", undefined, "normal", { locationName: `En el mar, de vuelta de ${d.targetIslandName}`, islandId: d.targetIslandId });
  invalidateWorldState();
}

async function arrive(d: AdmiralDispatch) {
  const claimed = await prisma.admiralDispatch.updateMany({ where: { id: d.id, status: "EN_ROUTE" }, data: { status: "ARRIVED", arrivedAt: new Date() } });
  if (claimed.count === 0) return;
  const admiral = await prisma.worldActor.findUnique({ where: { id: d.admiralActorId } });
  const here = await prisma.character.findMany({ where: { currentIslandId: d.targetIslandId, status: "ALIVE" }, include: { currentIsland: true } });
  const hunted = here.filter(isDispatchTarget);
  const free: typeof hunted = [];
  for (const c of hunted) if (!(await getOpenJointFightFor(c.id)) && !(await getOpenDuelFor(c.id))) free.push(c);
  if (!admiral || free.length === 0) {
    await returnHome({ ...d, status: "ARRIVED" }, `${d.admiralName} desembarcó en ${d.targetIslandName} y no encontró a ningún pirata: todos se habían marchado.`);
    return;
  }
  const now = new Date();
  await prisma.worldActor.update({ where: { id: admiral.id }, data: { currentIslandId: d.targetIslandId, locationKind: "island", seaFromIslandId: null, seaToIslandId: null, locationHidden: false, currentFocus: `Atacando ${d.targetIslandName}`, busyUntil: new Date(now.getTime() + 6 * 3600_000), locationUpdatedAt: now } });
  // Whoever stayed is pulled in: an unresolved encounter is swallowed by the real fight.
  await prisma.pendingEncounter.deleteMany({ where: { characterId: { in: free.map((c) => c.id) } } });
  const stats = actorCombatStats(admiral.powerLevel);
  const abilities = admiral.abilitiesJson ? (JSON.parse(admiral.abilitiesJson) as string[]) : [];
  try {
    const started = await startJointFight({
      kind: "admiral",
      characterIds: free.map((c) => c.id),
      enemy: { name: admiral.name, ...stats, isBoss: true, personality: admiral.personality ?? undefined, worldActorId: admiral.id, isActor: true },
      rewards: { berries: admiral.powerLevel * 400, xp: admiral.powerLevel * 6, bounty: admiral.powerLevel * 40_000, islandDanger: 10 },
      stakes: `El almirante ${admiral.name} ha desembarcado en ${d.targetIslandName} para erradicar a los piratas. No hay escapatoria: solo vencerlo o caer prisioneros.`,
      context: { dispatchId: d.id },
    });
    await prisma.jointFightMessage.create({ data: { fightId: started.fightId, authorCharacterId: null, authorName: "Narrador", text: admiralOpening(admiral.name, d.targetIslandName, abilities[0] ?? null) } });
    await prisma.admiralDispatch.update({ where: { id: d.id }, data: { jointFightId: started.fightId } });
    await postNews(
      `${admiral.name} desembarca en ${d.targetIslandName}`,
      `El almirante ${admiral.name} ha llegado a ${d.targetIslandName} y se enfrenta a ${free.map((c) => c.name).join(", ")}. Nadie puede abandonar la isla.`,
      "Gobierno Mundial",
      undefined,
      "major",
      { locationName: d.targetIslandName, islandId: d.targetIslandId }
    );
    await notifyIsland(d.targetIslandId, "admiral-dispatch");
  } catch (err) {
    await logError("admiral-dispatch/arrive", err, { dispatchId: d.id });
    await prisma.admiralDispatch.update({ where: { id: d.id }, data: { status: "ENDED", endedAt: new Date() } });
    if (!(err instanceof JointFightError)) throw err;
  }
  invalidateWorldState();
}

async function finishReturn(d: AdmiralDispatch) {
  const claimed = await prisma.admiralDispatch.updateMany({ where: { id: d.id, status: "RETURNING" }, data: { status: "ENDED", endedAt: new Date() } });
  if (claimed.count === 0) return;
  await prisma.worldActor.update({ where: { id: d.admiralActorId }, data: { currentIslandId: d.originIslandId ?? undefined, locationKind: "island", seaFromIslandId: null, seaToIslandId: null, currentFocus: null, busyUntil: null, locationUpdatedAt: new Date() } });
  invalidateWorldState();
}

/** Settles a dispatch's clock (arrival, return) and, rarely, sends a new admiral. Fire-and-forget from the world tick. */
export async function tickAdmiralDispatch(now = new Date()): Promise<void> {
  if (inFlight.has("tick")) return;
  inFlight.add("tick");
  try {
    const open = await prisma.admiralDispatch.findFirst({ where: { status: { in: OPEN } }, orderBy: { createdAt: "desc" } });
    if (open) {
      const phase = dispatchPhase(open, now);
      if (phase === "arrive") await arrive(open);
      else if (phase === "home") await finishReturn(open);
      return;
    }
    const last = await prisma.admiralDispatch.findFirst({ where: { status: "ENDED" }, orderBy: { endedAt: "desc" } });
    if (!shouldStartDispatch(varietyRng(`dispatch-roll:${Math.floor(now.getTime() / 60_000)}`), { hasOpen: false, lastEndedAt: last?.endedAt ?? null, now })) return;
    await startDispatch();
  } catch (err) {
    await logError("admiral-dispatch/tick", err);
  } finally {
    inFlight.delete("tick");
  }
}

export interface DispatchAlert {
  id: string;
  admiralName: string;
  islandName: string;
  status: "EN_ROUTE" | "ARRIVED";
  arrivesAt: string;
  msLeft: number;
  /** True when the character is a hunted player (pirate, level 2+): the others only get to read about it. */
  hunted: boolean;
  fightActive: boolean;
}

/** The big alert of the island the character stands on, settling the clock first so the arrival never waits for the next world tick. */
export async function getDispatchAlertFor(characterId: string): Promise<DispatchAlert | null> {
  const me = await prisma.character.findUnique({ where: { id: characterId }, select: { currentIslandId: true, faction: true, level: true, status: true } });
  if (!me) return null;
  let d = await prisma.admiralDispatch.findFirst({ where: { targetIslandId: me.currentIslandId, status: { in: ["EN_ROUTE", "ARRIVED"] } }, orderBy: { createdAt: "desc" } });
  if (!d) return null;
  if (dispatchPhase(d, new Date()) === "arrive") {
    await arrive(d).catch((err) => logError("admiral-dispatch/arrive-poll", err, { characterId }));
    d = await prisma.admiralDispatch.findUnique({ where: { id: d.id } });
    if (!d || !["EN_ROUTE", "ARRIVED"].includes(d.status)) return null;
  }
  return {
    id: d.id,
    admiralName: d.admiralName,
    islandName: d.targetIslandName,
    status: d.status as "EN_ROUTE" | "ARRIVED",
    arrivesAt: d.arrivesAt.toISOString(),
    msLeft: Math.max(0, d.arrivesAt.getTime() - Date.now()),
    hunted: isDispatchTarget(me),
    fightActive: d.status === "ARRIVED" && !!d.jointFightId,
  };
}

/** A pirate who reaches an island under attack is pulled into the running fight: there is no way around the admiral. */
export async function joinAdmiralFightIfNeeded(characterId: string): Promise<void> {
  const me = await prisma.character.findUnique({ where: { id: characterId } });
  if (!me || !isDispatchTarget(me)) return;
  const d = await prisma.admiralDispatch.findFirst({ where: { targetIslandId: me.currentIslandId, status: "ARRIVED", jointFightId: { not: null } } });
  if (!d?.jointFightId) return;
  if (await getOpenJointFightFor(characterId)) return;
  const fight = await prisma.jointFight.findUnique({ where: { id: d.jointFightId } });
  if (!fight || fight.status !== "ACTIVE") return;
  await prisma.pendingEncounter.deleteMany({ where: { characterId } });
  await prisma.jointFightParticipant.create({ data: { fightId: fight.id, characterId, name: me.name, hp: Math.max(1, me.hp), maxHp: me.maxHp } });
  await prisma.jointFightMessage.create({ data: { fightId: fight.id, authorCharacterId: null, authorName: "Narrador", text: `${me.name} llega a ${d.targetIslandName} y se ve arrastrado al combate: el almirante no deja pasar a nadie.` } });
}

/** Called by joint-fight.ts when the admiral fight ends: the event closes, the news tell who fell and who was taken. */
export async function handleAdmiralFightSettled(p: { contextJson: string; outcome: "victory" | "defeat" | null; enemyName: string; humans: { characterId: string; status: string; name: string }[] }): Promise<string[]> {
  let ctx: { dispatchId?: string } = {};
  try {
    ctx = JSON.parse(p.contextJson);
  } catch {
    return [];
  }
  if (!ctx.dispatchId) return [];
  const d = await prisma.admiralDispatch.findUnique({ where: { id: ctx.dispatchId } });
  if (!d || d.status === "ENDED") return [];
  const captured = p.outcome === "defeat" ? p.humans.filter((h) => h.status === "DOWN").map((h) => h.name) : [];
  await prisma.admiralDispatch.update({ where: { id: d.id }, data: { status: "ENDED", endedAt: new Date(), captured: JSON.stringify(captured) } });
  await prisma.worldActor.update({ where: { id: d.admiralActorId }, data: { locationKind: "island", currentIslandId: d.targetIslandId, seaFromIslandId: null, seaToIslandId: null, currentFocus: p.outcome === "victory" ? "Derrotado por unos piratas: se retira" : null, busyUntil: new Date(Date.now() + 24 * 3600_000) } });
  const where = { locationName: d.targetIslandName, islandId: d.targetIslandId };
  if (p.outcome === "defeat") {
    await postNews(`${d.admiralName} arrasa ${d.targetIslandName}: ${captured.length} capturados`, `Nadie pudo con el almirante ${d.admiralName} en ${d.targetIslandName}. Capturados: ${captured.join(", ")}. Los prisioneros son enviados a manos del Gobierno.`, "Gobierno Mundial", undefined, "major", where);
  } else if (p.outcome === "victory") {
    await postNews(`¡Los piratas de ${d.targetIslandName} derrotan al almirante ${d.admiralName}!`, `Contra todo pronóstico, ${p.humans.filter((h) => h.status !== "FLED").map((h) => h.name).join(", ")} plantaron cara al almirante ${d.admiralName} y lo obligaron a retirarse de ${d.targetIslandName}.`, "Guerra", undefined, "major", where);
  }
  invalidateWorldState();
  return p.outcome === "defeat" ? [`${d.admiralName} se retira de ${d.targetIslandName} con sus prisioneros.`] : p.outcome === "victory" ? [`${d.admiralName} se retira de ${d.targetIslandName}, derrotado.`] : [];
}
