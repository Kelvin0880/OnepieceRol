import { prisma } from "../db";
import { varietyRng } from "../engine/rng";
import { generateMissionSpecs, progressGain, isComplete, shouldGenerateBatch, MissionEvent, MissionKind } from "../engine/missions";
import { canEnterIsland } from "../engine/travel";
import { narrateIslandBriefing } from "../ai/narrate";
import { grantXp } from "./xp";
import { addStanding } from "./alliance";
import { notifyCharacters } from "../realtime";
import { judgeMissionProgress } from "../ai/judge";
import { judgeableKinds } from "../engine/mission-judge";

const inFlight = new Map<string, Promise<void>>();

async function openNeighbours(connections: string, level: number): Promise<string[]> {
  const ids = JSON.parse(connections) as string[];
  const neighbours = await prisma.island.findMany({ where: { id: { in: ids } } });
  return neighbours.filter((n) => canEnterIsland(level, n.minLevelToEnter) && !n.tidal && !n.requiresRoadPoneglyphs).map((n) => n.name);
}

async function islandPowers(islandId: string) {
  const t = await prisma.territory.findUnique({ where: { islandId } });
  if (!t?.homeActorId) return { patronActorId: null as string | null, powers: [] as { name: string; description: string }[] };
  const actor = await prisma.worldActor.findUnique({ where: { id: t.homeActorId } });
  return { patronActorId: actor?.id ?? null, powers: actor ? [{ name: actor.name, description: actor.description }] : [] };
}

async function generateBatch(characterId: string): Promise<void> {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.status !== "ALIVE") return;
  const island = c.currentIsland;
  const active = await prisma.mission.count({ where: { characterId, islandId: island.id, status: "ACTIVE" } });
  const last = await prisma.mission.findFirst({ where: { characterId, islandId: island.id }, orderBy: { createdAt: "desc" } });
  if (!shouldGenerateBatch(active, last?.createdAt.getTime() ?? null, Date.now())) return;

  const neighbours = await openNeighbours(island.connections, c.level);
  const { loadRoster, engagedNpcIds } = await import("./island-npcs");
  const { npcState } = await import("../engine/island-npc");
  const rosterAll = await loadRoster(island.id);
  const engaged = await engagedNpcIds(characterId);
  const residents = rosterAll.filter((n) => npcState(n, new Date(), engaged).usable).map((n) => ({ id: n.id, name: n.name, title: n.title, category: n.category, level: n.level }));
  const specs = generateMissionSpecs(varietyRng(`${characterId}:${island.id}:${Math.floor(Date.now() / 3_600_000)}`), { level: c.level, danger: island.dangerLevel, minLevel: island.minLevelToEnter, islandName: island.name, arcHook: island.arcHook, openNeighbours: neighbours, residents });
  const { patronActorId } = await islandPowers(island.id);
  await prisma.mission.createMany({
    data: specs.map((s) => ({
      characterId,
      islandId: island.id,
      kind: s.kind,
      title: s.title,
      brief: s.brief,
      target: s.target,
      tier: s.tier,
      berries: s.berries,
      xp: s.xp,
      destination: s.destination,
      isArc: s.isArc,
      patronActorId: s.isArc ? patronActorId : null,
      giverNpcId: s.giverNpcId ?? null,
      targetNpcId: s.targetNpcId ?? null,
    })),
  });

  const first = await prisma.islandBriefing.findUnique({ where: { characterId_islandId: { characterId, islandId: island.id } } });
  if (first) return;
  try {
    await prisma.islandBriefing.create({ data: { characterId, islandId: island.id } });
  } catch {
    return; // another request created it first
  }
  const isStart = (JSON.parse(c.islandsVisited) as string[]).length <= 1;
  const { powers } = await islandPowers(island.id);
  // Fire and forget: the AI panorama can take a while and must never block the request that triggered it.
  void (async () => {
    const text = await narrateIslandBriefing(
      {
        characterName: c.name,
        faction: c.faction,
        level: c.level,
        islandName: island.name,
        islandDescription: island.description,
        arcHook: island.arcHook,
        factionControl: island.factionControl,
        danger: island.dangerLevel,
        minLevel: island.minLevelToEnter,
        isStart,
        powers,
        missions: specs.map((s) => ({ title: s.title, brief: s.brief })),
        residents: rosterAll.filter((n) => n.status === "ALIVE").slice(0, 10).map((n) => ({ name: n.name, title: n.title, personality: n.personality })),
      },
      { characterId }
    );
    await prisma.islandBriefing.update({ where: { characterId_islandId: { characterId, islandId: island.id } }, data: { text } });
    notifyCharacters([characterId], "briefing");
  })().catch(() => undefined);
}

/** Lazily makes sure the character has goals (and the AI panorama) for the island they stand on. */
export function ensureIslandMissions(characterId: string): Promise<void> {
  const existing = inFlight.get(characterId);
  if (existing) return existing;
  const run = generateBatch(characterId).finally(() => inFlight.delete(characterId));
  inFlight.set(characterId, run);
  return run;
}

export async function getMissionState(characterId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c) return null;
  const missions = await prisma.mission.findMany({ where: { characterId, islandId: c.currentIslandId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 6 });
  const briefing = await prisma.islandBriefing.findUnique({ where: { characterId_islandId: { characterId, islandId: c.currentIslandId } } });
  return {
    islandName: c.currentIsland.name,
    briefing: briefing ? { text: briefing.text, ready: briefing.text.length > 0 } : null,
    missions: missions.map((m) => ({ id: m.id, kind: m.kind as MissionKind, title: m.title, brief: m.brief, progress: m.progress, target: m.target, berries: m.berries, xp: m.xp, tier: m.tier, isArc: m.isArc, status: m.status })),
  };
}

type ActiveMission = Awaited<ReturnType<typeof prisma.mission.findMany>>[number];

/** Applies progress to missions and pays the completed ones. Shared by exact engine events and by the story judge. */
async function settleGains(characterId: string, gains: { m: ActiveMission; gain: number }[]): Promise<string[]> {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c) return [];
  const log: string[] = [];
  let berries = 0;
  let xp = 0;
  for (const { m, gain } of gains) {
    const progress = m.progress + gain;
    if (!isComplete(progress, m.target)) {
      await prisma.mission.update({ where: { id: m.id }, data: { progress } });
      log.push(`Misión «${m.title}»: ${progress}/${m.target}.`);
      continue;
    }
    await prisma.mission.update({ where: { id: m.id }, data: { progress: m.target, status: "DONE", completedAt: new Date() } });
    berries += m.berries;
    xp += m.xp;
    log.push(`¡Misión cumplida! «${m.title}» (฿ ${m.berries.toLocaleString("es-ES")}, ${m.xp} XP).`);
    if (m.patronActorId) await addStanding(m.patronActorId, characterId, { mission: m.tier - 1 }, `cumpliste «${m.title}»`);
  }
  if (berries || xp) {
    const gained = await grantXp(c.experience, c.level, xp);
    await prisma.character.update({ where: { id: c.id }, data: { berries: c.berries + berries, experience: gained.xp, level: gained.level } });
    if (gained.leveledUp) log.push(`¡Subes de nivel! Ahora eres nivel ${gained.level}.`);
  }
  return log;
}

/** Advances every active mission the event counts toward; pays out completed ones. Never throws into the action that triggered it. */
export async function recordMissionEvent(characterId: string, event: MissionEvent): Promise<string[]> {
  try {
    const c = await prisma.character.findUnique({ where: { id: characterId } });
    if (!c) return [];
    const active = await prisma.mission.findMany({ where: { characterId, status: "ACTIVE" } });
    const gains: { m: ActiveMission; gain: number }[] = [];
    for (const m of active) {
      // Travel goals complete on arrival elsewhere; everything else only counts on the island that issued it.
      if (event.kind !== "travel" && m.islandId !== c.currentIslandId) continue;
      const gain = progressGain({ kind: m.kind as MissionKind, progress: m.progress, target: m.target, destination: m.destination, targetNpcId: m.targetNpcId }, event);
      if (gain > 0) gains.push({ m, gain });
    }
    return await settleGains(characterId, gains);
  } catch {
    return [];
  }
}

/**
 * The referee reads a story turn and moves the island goals it really accomplished (a sabotage that ends a gang counts
 * as much as a brawl), plus a hint when the player is on the right track. One step per mission per turn, only here.
 */
export async function judgeAndRecordMissions(characterId: string, playerText: string, narration: string, includeExplore: boolean): Promise<string[]> {
  try {
    const c = await prisma.character.findUnique({ where: { id: characterId }, select: { currentIslandId: true } });
    if (!c || !narration.trim()) return [];
    const kinds = judgeableKinds(includeExplore);
    const active = await prisma.mission.findMany({ where: { characterId, status: "ACTIVE", islandId: c.currentIslandId, kind: { in: kinds } } });
    if (active.length === 0) return [];
    const verdicts = await judgeMissionProgress({ playerText, narration, characterId, missions: active.map((m) => ({ id: m.id, title: m.title, brief: m.brief, kind: m.kind, progress: m.progress, target: m.target })) });
    const gains = verdicts.filter((v) => v.advance).flatMap((v) => { const m = active.find((x) => x.id === v.id); return m ? [{ m, gain: 1 }] : []; });
    const log = await settleGains(characterId, gains);
    const hints = verdicts.filter((v) => !v.advance && v.hint).map((v) => `Misión «${active.find((x) => x.id === v.id)?.title}»: ${v.hint}`);
    return [...log, ...hints.slice(0, 1)];
  } catch {
    return [];
  }
}
