import { CharacterStatus } from "@prisma/client";
import { prisma } from "../db";
import { varietyRng } from "../engine/rng";
import { EVENT_FRUITS } from "./devil-fruit-events";
import { inventEvent, judgeTrial, type TrialEntry } from "../ai/player-event";
import { storeFruitInBag } from "./inventory";
import { grantXp } from "./xp";
import { postNews } from "./death-resolution";
import { logError } from "../log-error";
import {
  EVENT_DEFAULT_MAX_LEVEL,
  EVENT_DEFAULT_MIN_LEVEL,
  canCreateMore,
  canJoin,
  cleanSubmission,
  defaultPrize,
  joinLine,
  pendingHumans,
  pickWinner,
  REGISTRATION_WINDOW_MS,
  progressLine,
  readyToResolve,
  rewardFor,
  rewardSummary,
} from "../engine/player-events";

export class PlayerEventError extends Error {}

export const EVENT_NEWS_CATEGORY = "Eventos";

const inFlight = new Set<string>();

async function ownedCharacter(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { pendingEncounter: { select: { id: true } } } });
  if (!c || c.userId !== userId) throw new PlayerEventError("Personaje no encontrado.");
  return c;
}

/** Event fruits nobody owns and no open event has reserved yet. */
export async function availableEventFruits(): Promise<{ id: string; name: string; description: string }[]> {
  const rows = await prisma.devilFruit.findMany({ where: { name: { in: EVENT_FRUITS.map((f) => f.name) } }, select: { id: true, name: true, description: true } });
  const reserved = new Set((await prisma.playerEvent.findMany({ where: { status: { in: ["OPEN", "RESOLVING"] }, rewardFruitId: { not: null } }, select: { rewardFruitId: true } })).map((e) => e.rewardFruitId));
  const out: { id: string; name: string; description: string }[] = [];
  for (const r of rows) {
    if (reserved.has(r.id)) continue;
    const owned = await prisma.character.count({ where: { devilFruitId: r.id } });
    if (owned > 0) continue;
    const bagged = await prisma.inventoryItem.count({ where: { kind: "Fruta del Diablo", effectJson: { contains: r.id } } });
    if (bagged > 0) continue;
    out.push(r);
  }
  return out;
}

export interface CreateEventOptions {
  idea?: string | null;
  islandName?: string | null;
  maxLevel?: number;
  withFruit?: boolean | null; // null = decide by variety
  createdBy?: string;
}

/** Announces a new event: the AI invents the trial and its NPC rivals, the system fixes the prize, the news tells everyone. */
export async function createPlayerEvent(opts: CreateEventOptions = {}) {
  const maxLevel = Math.max(1, Math.min(60, Math.round(opts.maxLevel ?? EVENT_DEFAULT_MAX_LEVEL)));
  const [islands, recent, fruits] = await Promise.all([
    prisma.island.findMany({ select: { id: true, name: true, dangerLevel: true, minLevelToEnter: true } }),
    prisma.playerEvent.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { title: true } }),
    availableEventFruits(),
  ]);
  // A beginner event is held where beginners can actually be: islands they may enter.
  const candidates = islands.filter((i) => i.minLevelToEnter <= maxLevel);
  if (opts.islandName && !islands.some((i) => i.name === opts.islandName)) throw new PlayerEventError("Esa isla no existe.");
  const rng = varietyRng(`event:${Math.floor(Date.now() / 60_000)}`);
  const wantsFruit = opts.withFruit ?? rng() < 0.5;
  const fruit = wantsFruit && fruits.length > 0 ? fruits[Math.floor(rng() * fruits.length)] : null;
  if (opts.withFruit && !fruit) throw new PlayerEventError("No quedan frutas únicas de evento sin dueño.");

  const npcRows = await prisma.islandNpc.findMany({ where: { status: "ALIVE" }, select: { name: true, title: true, islandId: true } });
  const draft = await inventEvent({
    islands: (candidates.length > 0 ? candidates : islands).map((i) => ({ name: i.name, danger: i.dangerLevel, residents: npcRows.filter((n) => n.islandId === i.id).slice(0, 5).map((n) => `${n.name} (${n.title})`) })),
    recentTitles: recent.map((r) => r.title),
    maxLevel,
    fruit: fruit ? { name: fruit.name, description: fruit.description } : null,
    idea: opts.idea ?? null,
    forceIsland: opts.islandName ?? null,
  });
  const island = islands.find((i) => i.name === draft.islandName) ?? islands[0];
  const prize = defaultPrize(maxLevel);
  const rewardText = rewardSummary({ fruitName: fruit?.name ?? null, berries: prize.berries, xp: prize.xp });
  const ev = await prisma.playerEvent.create({
    data: {
      title: draft.title,
      description: draft.description,
      islandId: island.id,
      islandName: island.name,
      minLevel: EVENT_DEFAULT_MIN_LEVEL,
      maxLevel,
      rewardFruitName: fruit?.name ?? null,
      rewardFruitId: fruit?.id ?? null,
      rewardBerries: prize.berries,
      rewardXp: prize.xp,
      rewardText,
      createdBy: opts.createdBy ?? "ai",
    },
  });
  const now = new Date();
  // The rivals are real residents of that island (never invented): the ones with most standing first.
  const residents = (await prisma.islandNpc.findMany({ where: { islandId: island.id, status: "ALIVE" }, orderBy: [{ level: "desc" }, { name: "asc" }] })).slice(0, 3);
  const rivals = residents.length > 0 ? residents.map((n) => ({ name: n.name, concept: `${n.title}. ${n.personality}`, level: Math.max(1, Math.min(maxLevel, n.level)) })) : [];
  await prisma.playerEventEntry.createMany({
    data: rivals.map((r) => ({ eventId: ev.id, name: r.name, isNpc: true, level: r.level, concept: r.concept, status: "SUBMITTED", submittedAt: now })),
  });
  await postNews(
    `Evento para principiantes en ${island.name}: ${ev.title}`,
    `${ev.description}\n\nPremio para el ganador: ${rewardText}. Abierto a niveles ${ev.minLevel}-${ev.maxLevel}. Para participar debes estar en ${island.name}. Las inscripciones están abiertas al menos ${REGISTRATION_WINDOW_MS / 3_600_000} horas y no hay límite de tiempo para completar la prueba: el evento termina cuando todos los inscritos hayan terminado. Rivales ya inscritos: ${rivals.map((r) => r.name).join(", ") || "ninguno todavía"}.`,
    EVENT_NEWS_CATEGORY,
    undefined,
    "major",
    { locationName: island.name, islandId: island.id }
  );
  return ev;
}

export async function joinEvent(characterId: string, userId: string, eventId: string) {
  const c = await ownedCharacter(characterId, userId);
  const ev = await prisma.playerEvent.findUnique({ where: { id: eventId } });
  if (!ev || ev.status !== "OPEN") throw new PlayerEventError("Ese evento ya no está abierto.");
  const mine = await prisma.playerEventEntry.findFirst({ where: { eventId, characterId } });
  const atSea = !!c.voyageToIslandId && !!c.voyageArrivesAt && c.voyageArrivesAt.getTime() > Date.now();
  const reason = canJoin({
    level: c.level,
    status: c.status,
    minLevel: ev.minLevel,
    maxLevel: ev.maxLevel,
    onIslandId: c.currentIslandId,
    eventIslandId: ev.islandId,
    alreadyIn: !!mine && mine.status !== "WITHDRAWN",
    busyReason: c.pendingEncounter ? "Termina primero tu pelea en curso." : atSea ? "Estás en alta mar." : null,
  });
  if (reason) throw new PlayerEventError(reason);
  if (mine) await prisma.playerEventEntry.update({ where: { id: mine.id }, data: { status: "REGISTERED", level: c.level, name: c.name } });
  else await prisma.playerEventEntry.create({ data: { eventId, characterId, name: c.name, level: c.level, status: "REGISTERED" } });
  const total = await prisma.playerEventEntry.count({ where: { eventId, status: { not: "WITHDRAWN" } } });
  await postNews(`${ev.title}: nuevo participante`, joinLine(c.name, total), EVENT_NEWS_CATEGORY, undefined, "normal", { locationName: ev.islandName, islandId: ev.islandId });
  return { log: [`Te inscribes en «${ev.title}». Cuando estés listo, escribe cómo afrontas la prueba y envíalo.`] };
}

export async function withdrawFromEvent(characterId: string, userId: string, eventId: string) {
  const c = await ownedCharacter(characterId, userId);
  const entry = await prisma.playerEventEntry.findFirst({ where: { eventId, characterId: c.id } });
  if (!entry || entry.status !== "REGISTERED") throw new PlayerEventError("No puedes retirarte: no estás inscrito o ya enviaste tu intento.");
  await prisma.playerEventEntry.update({ where: { id: entry.id }, data: { status: "WITHDRAWN" } });
  const ev = await prisma.playerEvent.findUnique({ where: { id: eventId } });
  if (ev) await postNews(`${ev.title}: baja`, `${c.name} se retira de la prueba.`, EVENT_NEWS_CATEGORY, undefined, "normal", { locationName: ev.islandName, islandId: ev.islandId });
  await resolveIfReady(eventId);
  return { log: ["Te has retirado del evento."] };
}

export async function submitEventEntry(characterId: string, userId: string, eventId: string, text: string) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== CharacterStatus.ALIVE) throw new PlayerEventError("Solo un personaje vivo y libre puede participar.");
  const clean = cleanSubmission(text);
  if (!clean) throw new PlayerEventError("Cuenta con un poco más de detalle cómo afrontas la prueba (mínimo unas líneas).");
  const ev = await prisma.playerEvent.findUnique({ where: { id: eventId } });
  if (!ev || ev.status !== "OPEN") throw new PlayerEventError("Ese evento ya no está abierto.");
  const entry = await prisma.playerEventEntry.findFirst({ where: { eventId, characterId: c.id } });
  if (!entry || entry.status !== "REGISTERED") throw new PlayerEventError("No estás inscrito o ya enviaste tu intento.");
  // Only the request that flips the status counts, however many times the button is pressed.
  const claimed = await prisma.playerEventEntry.updateMany({ where: { id: entry.id, status: "REGISTERED" }, data: { status: "SUBMITTED", submissionText: clean, submittedAt: new Date(), level: c.level } });
  if (claimed.count === 0) throw new PlayerEventError("Ya enviaste tu intento.");
  const entries = await prisma.playerEventEntry.findMany({ where: { eventId } });
  await postNews(`${ev.title}: prueba completada`, progressLine(c.name, pendingHumans(entries)), EVENT_NEWS_CATEGORY, undefined, "normal", { locationName: ev.islandName, islandId: ev.islandId });
  const done = await resolveIfReady(eventId);
  return { log: [done ? "Tu intento fue el último: el juez ya dio el veredicto. Mira las noticias." : "Intento enviado. El evento termina cuando pase la ventana de inscripción y todos los inscritos hayan completado la prueba; el veredicto saldrá en las noticias."] };
}

async function characterSheet(id: string): Promise<string> {
  const c = await prisma.character.findUnique({ where: { id }, select: { level: true, faction: true, observationHaki: true, armamentHaki: true, devilFruitId: true } });
  if (!c) return "";
  const [fruit, weapons] = await Promise.all([c.devilFruitId ? prisma.devilFruit.findUnique({ where: { id: c.devilFruitId }, select: { name: true } }) : null, prisma.weapon.findMany({ where: { ownerId: id }, select: { name: true }, take: 4 })]);
  return `nivel ${c.level}, ${c.faction}; fruta: ${fruit?.name ?? "ninguna"}; Haki observación ${c.observationHaki}/100, armadura ${c.armamentHaki}/100; armas: ${weapons.map((w) => w.name).join(", ") || "ninguna"}`;
}

/** Judges the event if every human is done. Safe to call anywhere: a claim guarantees one resolution. */
export async function resolveIfReady(eventId: string, opts: { ignoreWindow?: boolean } = {}): Promise<boolean> {
  if (inFlight.has(eventId)) return false;
  inFlight.add(eventId);
  try {
    const ev = await prisma.playerEvent.findUnique({ where: { id: eventId } });
    if (!ev || ev.status !== "OPEN") return false;
    const entries = await prisma.playerEventEntry.findMany({ where: { eventId, status: { not: "WITHDRAWN" } }, orderBy: { createdAt: "asc" } });
    if (!readyToResolve(entries, opts.ignoreWindow ? undefined : { createdAt: ev.createdAt, now: new Date() })) return false;
    const claimed = await prisma.playerEvent.updateMany({ where: { id: eventId, status: "OPEN" }, data: { status: "RESOLVING" } });
    if (claimed.count === 0) return false;
    try {
      await resolveClaimed(eventId);
      return true;
    } catch (err) {
      await prisma.playerEvent.updateMany({ where: { id: eventId, status: "RESOLVING" }, data: { status: "OPEN" } });
      await logError("player-events/resolve", err, { eventId });
      return false;
    }
  } finally {
    inFlight.delete(eventId);
  }
}

async function resolveClaimed(eventId: string) {
  const ev = await prisma.playerEvent.findUniqueOrThrow({ where: { id: eventId } });
  const entries = await prisma.playerEventEntry.findMany({ where: { eventId, status: "SUBMITTED" }, orderBy: { createdAt: "asc" } });
  const trial: TrialEntry[] = [];
  for (const e of entries) trial.push({ name: e.name, level: e.level, isNpc: e.isNpc, concept: e.concept, text: e.submissionText, sheet: e.characterId ? await characterSheet(e.characterId) : null });
  const judged = await judgeTrial(ev.title, ev.description, trial);
  if (!judged) throw new Error("no judge answered");
  const scored = entries.map((e, i) => ({ ...e, score: judged[i].score, verdict: judged[i].verdict }));
  for (const e of scored) await prisma.playerEventEntry.update({ where: { id: e.id }, data: { score: e.score, verdict: e.verdict } });
  const winner = pickWinner(scored);
  if (!winner) throw new Error("no winner");

  const prize = { berries: ev.rewardBerries, xp: ev.rewardXp };
  let fruitGiven = false;
  let bagFull = false;
  for (const e of scored) {
    if (!e.characterId) continue;
    const isWinner = e.id === winner.id;
    const r = rewardFor(isWinner, prize);
    const c = await prisma.character.findUnique({ where: { id: e.characterId } });
    if (!c || c.status === "DEAD") continue;
    const xp = await grantXp(c.experience, c.level, r.xp);
    let berries = c.berries + r.berries;
    if (isWinner && ev.rewardFruitId && ev.rewardFruitName) {
      fruitGiven = await storeFruitInBag(c.id, { id: ev.rewardFruitId, name: ev.rewardFruitName });
      if (!fruitGiven) {
        bagFull = true;
        berries += r.berries; // a full bag never costs the winner the prize: it is paid in berries instead
      }
    }
    await prisma.character.update({ where: { id: c.id }, data: { experience: xp.xp, level: xp.level, berries } });
  }

  const ranking = [...scored].sort((a, b) => b.score - a.score);
  const winnerLine = winner.isNpc
    ? `Ha ganado ${winner.name}, uno de los rivales del evento, con ${winner.score} puntos. Ningún participante humano se lleva el premio principal${ev.rewardFruitName ? " y la fruta única sigue esperando otro evento" : ""}.`
    : `¡${winner.name} gana el evento con ${winner.score} puntos! Se lleva ${ev.rewardText}${bagFull ? " (la fruta no cupo en su mochila: recibe el equivalente en berries y la fruta vuelve al evento siguiente)" : ""}.`;
  const resultText = `${winnerLine}\n\nClasificación:\n${ranking.map((e, i) => `${i + 1}. ${e.name}${e.isNpc ? " (NPC)" : ""} — ${e.score} puntos${e.verdict ? `: ${e.verdict}` : ""}`).join("\n")}\n\nTodos los participantes que completaron la prueba reciben una pequeña recompensa de consolación.`;
  await prisma.playerEvent.update({
    where: { id: eventId },
    data: { status: "RESOLVED", winnerName: winner.name, winnerCharacterId: winner.characterId, resultText, resolvedAt: new Date(), ...(winner.isNpc || bagFull ? { rewardFruitId: null } : {}) },
  });
  await postNews(`Resultado del evento «${ev.title}»: gana ${winner.name}`, resultText, EVENT_NEWS_CATEGORY, undefined, "major", { locationName: ev.islandName, islandId: ev.islandId });
}

/** Called from the world tick (fire-and-forget): retries stuck resolutions and announces a new event when it is time. */
export async function tickPlayerEvents(now = new Date()): Promise<void> {
  if (inFlight.has("tick")) return;
  inFlight.add("tick");
  try {
    const open = await prisma.playerEvent.findMany({ where: { status: "OPEN" }, select: { id: true } });
    for (const o of open) await resolveIfReady(o.id);
    const last = await prisma.playerEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const stillOpen = await prisma.playerEvent.count({ where: { status: { in: ["OPEN", "RESOLVING"] } } });
    if (canCreateMore(stillOpen, last?.createdAt ?? null, now)) await createPlayerEvent({});
  } catch (err) {
    await logError("player-events/tick", err);
  } finally {
    inFlight.delete("tick");
  }
}

export interface EventView {
  id: string;
  title: string;
  description: string;
  islandName: string;
  here: boolean;
  minLevel: number;
  maxLevel: number;
  status: string;
  rewardText: string;
  participants: { name: string; isNpc: boolean; status: string }[];
  mine: { status: string; score: number | null; verdict: string | null } | null;
  resultText: string | null;
  canJoinReason: string | null;
  createdAt: Date;
}

/** Open events plus the last few results, from one character's point of view. */
export async function getEventsFor(characterId: string, userId: string): Promise<{ open: EventView[]; recent: EventView[] }> {
  const c = await ownedCharacter(characterId, userId);
  const rows = await prisma.playerEvent.findMany({ where: { OR: [{ status: { in: ["OPEN", "RESOLVING"] } }, { status: "RESOLVED", resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } }] }, orderBy: { createdAt: "desc" }, take: 20 });
  const entries = await prisma.playerEventEntry.findMany({ where: { eventId: { in: rows.map((r) => r.id) } }, orderBy: { createdAt: "asc" } });
  const atSea = !!c.voyageToIslandId && !!c.voyageArrivesAt && c.voyageArrivesAt.getTime() > Date.now();
  const view = (r: (typeof rows)[number]): EventView => {
    const es = entries.filter((e) => e.eventId === r.id);
    const mine = es.find((e) => e.characterId === c.id) ?? null;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      islandName: r.islandName,
      here: r.islandId === c.currentIslandId,
      minLevel: r.minLevel,
      maxLevel: r.maxLevel,
      status: r.status,
      rewardText: r.rewardText,
      participants: es.filter((e) => e.status !== "WITHDRAWN").map((e) => ({ name: e.name, isNpc: e.isNpc, status: e.status })),
      mine: mine && mine.status !== "WITHDRAWN" ? { status: mine.status, score: mine.score, verdict: mine.verdict } : null,
      resultText: r.resultText,
      canJoinReason:
        r.status !== "OPEN"
          ? "Cerrado."
          : canJoin({ level: c.level, status: c.status, minLevel: r.minLevel, maxLevel: r.maxLevel, onIslandId: c.currentIslandId, eventIslandId: r.islandId, alreadyIn: !!mine && mine.status !== "WITHDRAWN", busyReason: c.pendingEncounter ? "Termina primero tu pelea en curso." : atSea ? "Estás en alta mar." : null }),
      createdAt: r.createdAt,
    };
  };
  return { open: rows.filter((r) => r.status !== "RESOLVED").map(view), recent: rows.filter((r) => r.status === "RESOLVED").map(view) };
}

// ------------------------------------------------------------ admin

export async function adminListEvents() {
  const rows = await prisma.playerEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const entries = await prisma.playerEventEntry.findMany({ where: { eventId: { in: rows.map((r) => r.id) } } });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    islandName: r.islandName,
    status: r.status,
    rewardText: r.rewardText,
    winnerName: r.winnerName,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    entries: entries.filter((e) => e.eventId === r.id).map((e) => ({ name: e.name, isNpc: e.isNpc, status: e.status })),
  }));
}

/** Owner tool: cancel an event (the reserved fruit is freed), announcing it. */
export async function cancelPlayerEvent(eventId: string) {
  const ev = await prisma.playerEvent.findUnique({ where: { id: eventId } });
  if (!ev || (ev.status !== "OPEN" && ev.status !== "RESOLVING")) throw new PlayerEventError("Ese evento no está abierto.");
  await prisma.playerEvent.update({ where: { id: eventId }, data: { status: "CANCELLED", resolvedAt: new Date(), rewardFruitId: null } });
  await postNews(`Evento cancelado: ${ev.title}`, "Los organizadores han suspendido el evento. Nadie pierde nada y el premio vuelve a quedar en juego para otra ocasión.", EVENT_NEWS_CATEGORY, undefined, "normal", { locationName: ev.islandName, islandId: ev.islandId });
}

/** Owner tool for a stuck event: everyone who has not handed in is withdrawn and the judge decides with what there is. */
export async function forceResolvePlayerEvent(eventId: string): Promise<boolean> {
  const ev = await prisma.playerEvent.findUnique({ where: { id: eventId } });
  if (!ev || ev.status !== "OPEN") throw new PlayerEventError("Ese evento no está abierto.");
  await prisma.playerEventEntry.updateMany({ where: { eventId, isNpc: false, status: "REGISTERED" }, data: { status: "WITHDRAWN" } });
  const ok = await resolveIfReady(eventId, { ignoreWindow: true });
  if (!ok) throw new PlayerEventError("No hay ningún intento humano enviado que juzgar (o el juez no respondió): cancela el evento o espera.");
  return true;
}
