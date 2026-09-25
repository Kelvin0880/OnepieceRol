import { prisma } from "../db";
import { canSailAnywhere, describeVoyageWait, hopsBetween, isYonkoClass, seaAmbushChance, voyageDurationMs, voyageStatus, type IslandGraph } from "../engine/voyage";
import { seaLabel } from "../engine/actor-movement";
import { assessThreat } from "../engine/encounter";
import { canEnterIsland, knowsTheRoad, tideStatus } from "../engine/travel";
import { toCombatant } from "./derive";
import { GameActionError } from "./perform-action";
import { postNews } from "./death-resolution";
import { ONE_PIECE_TRUTH, ONE_PIECE_TRUTH_TITLE, truthNewsBody } from "./endgame-lore";

export interface VoyageView {
  toName: string;
  fromName: string;
  arrivesAt: string;
  msLeft: number;
}

/** Guard for anything that needs solid ground under your feet. */
export function assertNotAtSea(c: { voyageToIslandId: string | null; voyageArrivesAt: Date | null }): void {
  if (!c.voyageToIslandId) return;
  const st = voyageStatus(c.voyageArrivesAt);
  if (st.atSea) throw new GameActionError(`Estás en alta mar. Llegarás en ${describeVoyageWait(st.msLeft)}.`);
}

/**
 * Lands a character whose crossing is over. Lazy (runs on every character load/poll), and race-safe:
 * only the request that clears the voyage columns writes the arrival.
 */
export async function settleVoyage(characterId: string): Promise<{ landedAt: string; log: string[] } | null> {
  const c = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true, name: true, title: true, bounty: true, islandsVisited: true, knowsTruth: true, voyageToIslandId: true, voyageArrivesAt: true, voyageAmbushJson: true },
  });
  if (!c?.voyageToIslandId || !c.voyageArrivesAt || !voyageStatus(c.voyageArrivesAt).arrived) return null;
  const target = await prisma.island.findUnique({ where: { id: c.voyageToIslandId } });
  const visited = JSON.parse(c.islandsVisited) as string[];
  const firstVisit = !!target && !visited.includes(target.id);
  const claim = await prisma.character.updateMany({
    where: { id: c.id, voyageToIslandId: c.voyageToIslandId },
    data: {
      ...(target ? { currentIslandId: target.id, islandsVisited: firstVisit ? JSON.stringify([...visited, target.id]) : c.islandsVisited } : {}),
      voyageToIslandId: null,
      voyageFromIslandId: null,
      voyageArrivesAt: null,
      voyageAmbushJson: null,
    },
  });
  if (claim.count === 0 || !target) return null;

  const log = [`Tras la travesía, desembarcas en ${target.name}.`];
  if (firstVisit && target.arcHook) log.push(target.arcHook);
  const revealed = target.requiresRoadPoneglyphs && !c.knowsTruth;
  if (revealed) {
    await prisma.character.update({ where: { id: c.id }, data: { knowsTruth: true } });
    await postNews(`${c.name} llega a Laugh Tale`, truthNewsBody(c.name), "Gobierno Mundial", c.id, "major");
    log.push(`— ${ONE_PIECE_TRUTH_TITLE} —`, ONE_PIECE_TRUTH);
  }
  for (const text of log) await prisma.gameLogEntry.create({ data: { characterId: c.id, kind: "travel", text } });
  if (c.voyageAmbushJson) await springAmbush(c.id, target.dangerLevel, c.voyageAmbushJson, log);
  if (isYonkoClass(c.title, c.bounty)) {
    await postNews(`${c.name} desembarca en ${target.name}`, `${c.title ?? "El Emperador"} ${c.name} ha llegado a ${target.name}. Allí donde pone el pie un Yonko, el mundo contiene el aliento.`, "Guerra", c.id, "major", { locationName: target.name, islandId: target.id });
  }
  return { landedAt: target.name, log };
}

/** The ambush rolled at departure catches up as the ship comes into port: a real pending fight, scaled to the traveler. */
async function springAmbush(characterId: string, islandDanger: number, json: string, log: string[]): Promise<void> {
  try {
    const amb = JSON.parse(json) as { name: string; blurb: string; power: number };
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { devilFruit: true, equippedWeapon: true, styles: true, ownedWeapons: { where: { wielded: true } }, pendingEncounter: true },
    });
    if (!character || character.pendingEncounter) return;
    const me = toCombatant(character);
    const enemy = { name: amb.name, hp: Math.round(character.maxHp * 1.1 * amb.power), atk: Math.round(me.atk * amb.power), def: Math.round(me.def * 0.9 * amb.power), spd: Math.round(me.spd * amb.power), isBoss: false };
    const assessment = assessThreat(me, { name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd });
    const narrative = `${amb.blurb} Justo antes de tocar puerto, te alcanzan.`;
    await prisma.pendingEncounter.create({
      data: {
        characterId,
        enemyJson: JSON.stringify(enemy),
        rewardsJson: JSON.stringify({ berries: 4000 * Math.max(1, islandDanger), xp: 30 + character.level * 2, bounty: 0, islandDanger }),
        narrative,
        assessment,
      },
    });
    await prisma.gameLogEntry.create({ data: { characterId, kind: "ambush", text: narrative } });
    log.push(narrative);
  } catch {
    // an ambush that cannot be built is simply a quiet crossing
  }
}

export async function startVoyage(character: { id: string; name: string; title: string | null; bounty: number; currentIslandId: string }, fromName: string, target: { id: string; name: string }, durationMs: number, staminaData: { stamina: number; staminaUpdatedAt: Date }, ambush: { name: string; blurb: string; power: number } | null): Promise<string[]> {
  const arrivesAt = new Date(Date.now() + durationMs);
  await prisma.character.update({
    where: { id: character.id },
    data: { voyageToIslandId: target.id, voyageFromIslandId: character.currentIslandId, voyageArrivesAt: arrivesAt, lastTravelAt: new Date(), voyageAmbushJson: ambush ? JSON.stringify(ambush) : null, ...staminaData },
  });
  const line = `Zarpas de ${fromName} rumbo a ${target.name}. La travesía durará unos ${describeVoyageWait(durationMs)}; llegarás sin que tengas que hacer nada.`;
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "travel", text: line } });
  if (isYonkoClass(character.title, character.bounty)) {
    await postNews(`${character.name} zarpa rumbo a ${target.name}`, `${character.title ?? "Un Emperador"} ${character.name} ha levado anclas desde ${fromName} con destino ${target.name}. Nadie se atreve a apostar qué busca allí.`, "Guerra", character.id, "major", { locationName: seaLabel(fromName, target.name) });
  }
  return [line];
}

export async function getVoyageView(characterId: string): Promise<VoyageView | null> {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { voyageToIslandId: true, voyageFromIslandId: true, voyageArrivesAt: true } });
  if (!c?.voyageToIslandId || !c.voyageArrivesAt) return null;
  const st = voyageStatus(c.voyageArrivesAt);
  if (!st.atSea) return null;
  const islands = await prisma.island.findMany({ where: { id: { in: [c.voyageToIslandId, c.voyageFromIslandId ?? ""] } }, select: { id: true, name: true } });
  const name = (id: string | null) => islands.find((i) => i.id === id)?.name ?? "el horizonte";
  return { toName: name(c.voyageToIslandId), fromName: name(c.voyageFromIslandId), arrivesAt: c.voyageArrivesAt.toISOString(), msLeft: st.msLeft };
}

export interface VoyageOption {
  islandId: string;
  name: string;
  sea: string;
  hops: number;
  durationMs: number;
  risk: number;
  danger: number;
  blocked: string | null;
}

/** The "where do you want to sail" menu: every island with the trip time, the risk of an ambush and why it might be closed. */
export async function getVoyageOptions(characterId: string): Promise<{ from: string; canSailAnywhere: boolean; options: VoyageOption[] }> {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c) return { from: "", canSailAnywhere: false, options: [] };
  const anywhere = canSailAnywhere(c.level);
  if (!anywhere) return { from: c.currentIsland.name, canSailAnywhere: false, options: [] };
  const islands = await prisma.island.findMany();
  const graph: IslandGraph = {};
  for (const i of islands) graph[i.id] = JSON.parse(i.connections) as string[];
  const roadIds = (await prisma.poneglyph.findMany({ where: { kind: "Road" }, select: { id: true } })).map((p) => p.id);
  const read = JSON.parse(c.poneglyphsRead) as string[];
  const options: VoyageOption[] = [];
  for (const i of islands) {
    if (i.id === c.currentIslandId) continue;
    const hops = hopsBetween(graph, c.currentIslandId, i.id);
    if (hops === null) continue;
    let blocked: string | null = null;
    if (!canEnterIsland(c.level, i.minLevelToEnter)) blocked = `Requiere nivel ${i.minLevelToEnter}`;
    else if (i.requiresRoadPoneglyphs && !knowsTheRoad(read, roadIds)) blocked = "Solo con los cuatro Poneglifos de Ruta";
    else if (i.tidal && !tideStatus().open) blocked = "Sumergida por la marea";
    options.push({ islandId: i.id, name: i.name, sea: i.sea, hops, durationMs: hops === 1 ? 0 : voyageDurationMs(hops), risk: Math.round(seaAmbushChance(hops) * 100), danger: i.dangerLevel, blocked });
  }
  options.sort((a, b) => a.hops - b.hops || a.name.localeCompare(b.name));
  return { from: c.currentIsland.name, canSailAnywhere: true, options };
}
