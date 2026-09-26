// Filler cast of the islands (IslandNpc): roster for the AI, binding fights to residents, live status, deaths, captures, memory and automatic successors.
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db";
import { postNews } from "./death-resolution";
import { generateSuccessor } from "../ai/island-npc";
import { logError } from "../log-error";
import {
  appendMemory,
  dueForReplacement,
  fallbackSuccessor,
  matchNpc,
  npcState,
  isFighter,
  npcRewards,
  npcStats,
  npcSummaryForFight,
  pickCombatNpc,
  rosterBlock,
  type IslandNpcRow,
} from "../engine/island-npc";

const MAX_SUCCESSORS_PER_TICK = 3;
const WOUNDED_MS = 3 * 60 * 60_000;
const JAIL_MS = 24 * 60 * 60_000;
const LAW_FACTIONS = new Set(["MARINE", "CP0", "BOUNTY_HUNTER"]);
const CRIMINAL = new Set(["thug", "pirate"]);

export async function loadRoster(islandId: string): Promise<IslandNpcRow[]> {
  return prisma.islandNpc.findMany({ where: { islandId }, orderBy: [{ status: "asc" }, { name: "asc" }] });
}

/** Residents currently in somebody's fight (solo encounter or joint fight), except the ones of `exceptCharacterId`, who can keep using theirs. */
export async function engagedNpcIds(exceptCharacterId?: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const grab = (json: string) => {
    try {
      const id = (JSON.parse(json) as { islandNpcId?: string }).islandNpcId;
      if (id) ids.add(id);
    } catch {
      /* not an npc fight */
    }
  };
  const [solo, joint] = await Promise.all([
    prisma.pendingEncounter.findMany({ where: { enemyJson: { contains: "islandNpcId" }, ...(exceptCharacterId ? { characterId: { not: exceptCharacterId } } : {}) }, select: { enemyJson: true } }),
    prisma.jointFight.findMany({
      where: { status: "ACTIVE", enemyJson: { contains: "islandNpcId" }, ...(exceptCharacterId ? { participants: { none: { characterId: exceptCharacterId } } } : {}) },
      select: { enemyJson: true },
    }),
  ]);
  for (const r of [...solo, ...joint]) grab(r.enemyJson);
  return ids;
}

async function unavailableFor(roster: IslandNpcRow[], characterId?: string): Promise<Set<string>> {
  const now = new Date();
  const engaged = await engagedNpcIds(characterId);
  return new Set(roster.filter((n) => !npcState(n, now, engaged).usable).map((n) => n.id));
}

/** Block for the narrator/referee: the only named characters allowed on this island, with live status. Empty for an island with no cast. */
export async function rosterBlockFor(islandId: string, islandName: string, characterId?: string): Promise<string> {
  const roster = await loadRoster(islandId);
  return rosterBlock(islandName, roster, new Date(), await engagedNpcIds(characterId));
}

/** Every name the AI may put in a scene at this island: residents (any state, so the dead can be remembered), canon actors, players, the character's own people. */
export async function allowedNamesFor(characterId: string, islandId: string): Promise<string[]> {
  const [roster, actors, chars, mine, places, recent, pending] = await Promise.all([
    loadRoster(islandId),
    prisma.worldActor.findMany({ select: { name: true } }),
    prisma.character.findMany({ where: { status: "ALIVE" }, select: { name: true }, take: 400 }),
    prisma.nPCCompanion.findMany({ where: { characterId }, select: { name: true } }),
    prisma.island.findMany({ select: { name: true } }),
    prisma.sceneMessage.findMany({ where: { characterId }, orderBy: { createdAt: "desc" }, take: 14, select: { text: true } }),
    prisma.pendingEncounter.findUnique({ where: { characterId }, select: { enemyJson: true } }),
  ]);
  // Names already established in the running scene stay usable (scenes that began before the roster existed); a new invention is still caught at its introduction.
  const established = recent.flatMap((m) => m.text.match(/[A-ZÁÉÍÓÚÑ][a-záéíóúñü'’-]{2,}/g) ?? []);
  const enemy = pending ? [(JSON.parse(pending.enemyJson) as { name?: string }).name ?? ""] : [];
  return [...roster.map((n) => n.name), ...actors.map((a) => a.name), ...chars.map((c) => c.name), ...mine.map((c) => c.name), ...places.map((p) => p.name), ...established, ...enemy];
}

export interface BoundEnemy {
  npcId: string;
  name: string;
  level: number;
  personality: string;
  kit: string;
  category: string;
  fighter: boolean;
  rewards: { berries: number; xp: number };
  stats: { hp: number; atk: number; def: number; spd: number };
}

function bind(n: IslandNpcRow): BoundEnemy {
  return { npcId: n.id, name: n.name, level: n.level, personality: n.personality, kit: npcSummaryForFight(n), category: n.category, fighter: isFighter(n.category), rewards: npcRewards(n.level, n.category), stats: npcStats(n.level, n.category) };
}

/** Whoever the player named (or the job they named) becomes that resident, if they are free right now; null when nobody available fits. */
export async function bindTarget(islandId: string, text: string, characterId?: string): Promise<BoundEnemy | null> {
  const roster = await loadRoster(islandId);
  const n = matchNpc(roster, text, await unavailableFor(roster, characterId));
  return n ? bind(n) : null;
}

/** A free resident for a random encounter on the island. */
export async function bindRandomFighter(islandId: string, seed: string, characterId?: string): Promise<BoundEnemy | null> {
  const roster = await loadRoster(islandId);
  const n = pickCombatNpc(roster, seed, undefined, await unavailableFor(roster, characterId));
  return n ? bind(n) : null;
}

/** Someone the player names who is dead, captured, hurt or busy: the reason to tell them, or null if the name matches nobody. */
export async function whyNotAvailable(islandId: string, text: string, characterId?: string): Promise<string | null> {
  const roster = await loadRoster(islandId);
  const all = new Set<string>();
  const n = matchNpc(roster.map((r) => ({ ...r, status: "ALIVE" })), text, all);
  if (!n) return null;
  const real = roster.find((r) => r.id === n.id)!;
  const st = npcState(real, new Date(), await engagedNpcIds(characterId));
  return st.usable ? null : `${real.name} no está disponible ahora: ${st.label}.`;
}

export async function getNpcKit(npcId: string): Promise<string | null> {
  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });
  return n ? npcSummaryForFight(n) : null;
}

/** A resident who joins a player's crew leaves the island; the tick gives their job to a successor. */
export async function recruitIslandNpc(npcId: string, by: { id: string; name: string }, islandName: string): Promise<void> {
  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });
  if (!n || n.status !== "ALIVE") return;
  await prisma.islandNpc.update({
    where: { id: npcId },
    data: { status: "RECRUITED", diedAt: new Date(), diedNote: `se unió a la tripulación de ${by.name}`, stateNote: `se marchó con ${by.name}`, memoryJson: appendMemory(n.memoryJson, `Se unió a la tripulación de ${by.name} en ${islandName}`) },
  });
  await postNews(`${n.name} se une a la tripulación de ${by.name}`, `${n.name} (${n.title}) ha dejado ${islandName} para navegar con ${by.name}.`, "Tripulaciones", by.id, "normal", { islandId: n.islandId, locationName: islandName });
}

export async function noteNpc(npcId: string, note: string): Promise<void> {
  const n = await prisma.islandNpc.findUnique({ where: { id: npcId }, select: { memoryJson: true } });
  if (!n) return;
  await prisma.islandNpc.update({ where: { id: npcId }, data: { memoryJson: appendMemory(n.memoryJson, note) } });
}

/** Records a death: the resident leaves the cast, the world hears about it, and a successor is scheduled by the tick. */
export async function killIslandNpc(npcId: string, by: { id?: string; name: string; credit?: string[] }, islandName: string): Promise<string[]> {
  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });
  if (!n || n.status === "DEAD") return [];
  const note = `muerto a manos de ${by.name} en ${islandName}`;
  const claimed = await prisma.islandNpc.updateMany({
    where: { id: npcId, status: { not: "DEAD" } },
    data: { status: "DEAD", diedAt: new Date(), diedNote: note, recoversAt: null, stateNote: null, memoryJson: appendMemory(n.memoryJson, `Murió ${note}`) },
  });
  if (claimed.count === 0) return [];
  await postNews(
    `${n.name}, ${n.title.toLowerCase()}, muere en ${islandName}`,
    `${n.name} (${n.title}) ha sido asesinado en ${islandName}. Los vecinos señalan a ${by.name}. ${n.description}`,
    "Muertes",
    by.id,
    "normal",
    { islandId: n.islandId, locationName: islandName }
  );
  return creditMissions(npcId, by);
}

/** A resident was beaten and spared: hurt for a while, or arrested if the winner enforces the law and the resident is a criminal. */
export async function defeatIslandNpc(npcId: string, by: { id?: string; name: string; faction: string; credit?: string[] }, islandName: string): Promise<string[]> {
  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });
  if (!n || n.status === "DEAD") return [];
  const arrest = LAW_FACTIONS.has(by.faction) && CRIMINAL.has(n.category);
  const now = Date.now();
  if (arrest) {
    await prisma.islandNpc.update({
      where: { id: npcId },
      data: { status: "CAPTURED", recoversAt: new Date(now + JAIL_MS), stateNote: `detenido por ${by.name}`, memoryJson: appendMemory(n.memoryJson, `${by.name} lo detuvo en ${islandName}`) },
    });
    await postNews(`${n.name} es detenido en ${islandName}`, `${by.name} ha arrestado a ${n.name} (${n.title}) en ${islandName}. Pasará un tiempo entre rejas.`, "Gobierno Mundial", by.id, "normal", { islandId: n.islandId, locationName: islandName });
  } else {
    await prisma.islandNpc.update({
      where: { id: npcId },
      data: { recoversAt: new Date(now + WOUNDED_MS), stateNote: `herido por la paliza de ${by.name}`, memoryJson: appendMemory(n.memoryJson, `${by.name} lo derrotó y le perdonó la vida`) },
    });
  }
  return creditMissions(npcId, by);
}

/** Defeating (or killing) the resident a mission asks for advances it for everyone who fought them. */
async function creditMissions(npcId: string, by: { id?: string; credit?: string[] }): Promise<string[]> {
  const { recordMissionEvent } = await import("./missions");
  const ids = new Set([...(by.credit ?? []), ...(by.id ? [by.id] : [])]);
  const mine: string[] = [];
  for (const id of ids) {
    const logs = await recordMissionEvent(id, { kind: "npc", npcId }).catch(() => [] as string[]);
    if (id === by.id) mine.push(...logs);
  }
  return mine;
}

export async function tickIslandNpcs(now = new Date()): Promise<number> {
  await prisma.islandNpc.updateMany({ where: { status: "CAPTURED", recoversAt: { lte: now } }, data: { status: "ALIVE", recoversAt: null, stateNote: null } });
  const dead = await prisma.islandNpc.findMany({ where: { status: { in: ["DEAD", "RECRUITED"] }, successorId: null } });
  const due = dueForReplacement(dead, now).slice(0, MAX_SUCCESSORS_PER_TICK);
  if (due.length === 0) return 0;
  const taken = new Set([...(await prisma.islandNpc.findMany({ select: { name: true } })).map((x) => x.name), ...(await prisma.worldActor.findMany({ select: { name: true } })).map((x) => x.name)]);
  let made = 0;
  for (const d of due) {
    try {
      const island = await prisma.island.findUnique({ where: { id: d.islandId }, select: { name: true, description: true } });
      if (!island) continue;
      const gen = await generateSuccessor({ islandName: island.name, islandDescription: island.description, dead: d, takenNames: taken });
      const fb = gen ? null : fallbackSuccessor(d, taken);
      const name = gen?.name ?? fb!.name;
      const created = await prisma.islandNpc.create({
        data: {
          name,
          islandId: d.islandId,
          slot: d.slot,
          title: gen?.title || d.title,
          category: d.category,
          description: gen?.description ?? fb!.description,
          personality: gen?.personality ?? fb!.personality,
          level: d.level,
          weapon: gen?.weapon ?? d.weapon,
          abilitiesJson: JSON.stringify(gen?.abilities?.length ? gen.abilities : d.abilitiesJson ? JSON.parse(d.abilitiesJson) : []),
          memoryJson: JSON.stringify([`Ocupó el puesto de ${d.name}, ${d.diedNote ?? "fallecido"}`]),
          generation: d.generation + 1,
        },
      });
      const linked = await prisma.islandNpc.updateMany({ where: { id: d.id, successorId: null }, data: { successorId: created.id } });
      if (linked.count === 0) {
        await prisma.islandNpc.delete({ where: { id: created.id } });
        continue;
      }
      taken.add(name);
      made++;
      const pending = await prisma.mission.findMany({ where: { targetNpcId: d.id, status: "ACTIVE" } });
      for (const m of pending) {
        await prisma.mission.update({ where: { id: m.id }, data: { targetNpcId: created.id, title: m.title.split(d.name).join(name), brief: m.brief.split(d.name).join(name) } });
      }
      await postNews(`${name} ocupa el puesto de ${d.name} en ${island.name}`, `Tras la muerte de ${d.name}, ${name} (${created.title}) ha llegado para hacerse cargo. ${created.description}`, "Sucesos del mundo", undefined, "normal", { islandId: d.islandId, locationName: island.name });
    } catch (err) {
      await logError("game/island-npc-successor", err, { deadId: d.id });
    }
  }
  return made;
}

export interface SeedRosterEntry {
  island: string; // island name
  slot: string;
  name: string;
  title: string;
  category: string;
  level: number;
  description: string;
  personality: string;
  weapon?: string | null;
  abilities?: string[];
}

/** Idempotent seed: creates missing residents, refreshes their description, never revives the dead or moves a successor. */
export async function seedIslandRoster(entries: SeedRosterEntry[], db: PrismaClient = prisma): Promise<number> {
  const islands = new Map((await db.island.findMany({ select: { id: true, name: true } })).map((i) => [i.name, i.id]));
  let n = 0;
  for (const e of entries) {
    const islandId = islands.get(e.island);
    if (!islandId) continue;
    const data = {
      islandId,
      slot: e.slot,
      title: e.title,
      category: e.category,
      level: e.level,
      description: e.description,
      personality: e.personality,
      weapon: e.weapon ?? null,
      abilitiesJson: JSON.stringify(e.abilities ?? []),
    };
    // A resident who died keeps their memorial; only living ones are refreshed.
    const existing = await db.islandNpc.findUnique({ where: { name: e.name }, select: { status: true } });
    if (existing?.status === "DEAD") continue;
    await db.islandNpc.upsert({ where: { name: e.name }, update: data, create: { name: e.name, ...data } });
    n++;
  }
  return n;
}

/** The residents of the island the character stands on, with their live state, for the play screen ("Gente de esta isla"). */
export async function getIslandCast(islandId: string, characterId: string) {
  const roster = await loadRoster(islandId);
  const engaged = await engagedNpcIds(characterId);
  const now = new Date();
  return roster
    .filter((n) => n.status !== "DEAD" || (n.diedNote && true))
    .map((n) => {
      const st = npcState(n, now, engaged);
      return { id: n.id, name: n.name, title: n.title, category: n.category, level: n.level, fighter: isFighter(n.category), state: st.label, usable: st.usable, dead: n.status === "DEAD", personality: n.personality, memory: (n.memoryJson ? (JSON.parse(n.memoryJson) as string[]) : []).slice(-2), diedNote: n.diedNote };
    })
    .sort((a, b) => Number(a.dead) - Number(b.dead) || Number(b.usable) - Number(a.usable) || a.name.localeCompare(b.name));
}

/** Every name the AI may use at an island when no single character is the viewpoint (joint fights, duels, world texts). */
export async function allowedNamesAt(islandId: string | null, extra: string[] = []): Promise<string[]> {
  const [roster, actors, chars, places] = await Promise.all([
    islandId ? loadRoster(islandId) : Promise.resolve([] as IslandNpcRow[]),
    prisma.worldActor.findMany({ select: { name: true } }),
    prisma.character.findMany({ where: { status: "ALIVE" }, select: { name: true }, take: 400 }),
    prisma.island.findMany({ select: { name: true } }),
  ]);
  return [...roster.map((n) => n.name), ...actors.map((a) => a.name), ...chars.map((c) => c.name), ...places.map((p) => p.name), ...extra];
}

/** Every name in the whole world (residents of every island, canon, players, places): for texts that are not tied to one island. */
export async function allowedNamesEverywhere(): Promise<string[]> {
  const [npcs, actors, chars, places] = await Promise.all([
    prisma.islandNpc.findMany({ select: { name: true } }),
    prisma.worldActor.findMany({ select: { name: true } }),
    prisma.character.findMany({ select: { name: true }, take: 800 }),
    prisma.island.findMany({ select: { name: true } }),
  ]);
  return [...npcs.map((n) => n.name), ...actors.map((a) => a.name), ...chars.map((c) => c.name), ...places.map((p) => p.name)];
}

/** World facts + the island's residents, for referees that have no single character (joint fights). */
export async function sceneDirectivesFor(islandId: string): Promise<string> {
  const island = await prisma.island.findUnique({ where: { id: islandId }, select: { name: true } });
  const [world, roster] = await Promise.all([
    import("./world-state").then((m) => m.worldStateBlock()).catch(() => ""),
    island ? rosterBlockFor(islandId, island.name) : Promise.resolve(""),
  ]);
  return [world, roster].filter(Boolean).map((t) => "\n\n" + t).join("");
}
