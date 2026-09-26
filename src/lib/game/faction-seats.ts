import { prisma } from "../db";
import { CharacterStatus, type SeatChallenge, type WorldActor } from "@prisma/client";
import {
  CANON_SEAT_DUEL_DELAY_MS,
  CANON_SEAT_EVENT_GAP_MS,
  isEntryAspirant,
  isSeatId,
  ladderFor,
  LADDER_NAME,
  pickBySeed,
  PLAYER_DEFENSE_GAP_MS,
  seatChallengeBlock,
  seatDuelHeadline,
  seatHolderStats,
  seatRequirements,
  seatRewards,
  SEAT_RESPONSE_WINDOW_MS,
  SEATS,
  seatSwap,
  type SeatChange,
  type SeatHolderRef,
  type SeatId,
} from "../engine/faction-seats";
import type { FactionKey } from "../engine/progression";
import { judgeMatch } from "../ai/judge";
import { postNews } from "./death-resolution";
import { notifyCharacters } from "../realtime";
import { invalidateWorldState } from "./world-state";
import { getOpenJointFightFor, JointFightError, startJointFight } from "./joint-fight";
import { getOpenDuelFor } from "./duel";

export class SeatError extends Error {}

export const SEAT_NEWS_CATEGORY = "Rangos y mandos";
const OPEN = ["PENDING", "FIGHTING", "ANNOUNCED"];
const HOUR = 3600_000;

const parse = <T>(json: string | null | undefined, fallback: T): T => {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
};

async function islandName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.island.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
}

async function hqIsland(seat: SeatId) {
  return prisma.island.findUnique({ where: { name: SEATS[seat].hq } });
}

async function openChallengeOf(id: string) {
  return prisma.seatChallenge.findFirst({ where: { status: { in: OPEN }, OR: [{ challengerId: id }, { defenderId: id }] } });
}

const actorBusy = (a: Pick<WorldActor, "busyUntil">, now: Date) => !!a.busyUntil && a.busyUntil > now;

async function holders(seat: SeatId) {
  const [canon, players] = await Promise.all([
    prisma.worldActor.findMany({ where: { seat, status: "ACTIVE" }, orderBy: { powerLevel: "desc" } }),
    prisma.character.findMany({ where: { seat, status: { not: CharacterStatus.DEAD } }, select: { id: true, name: true, currentIslandId: true, level: true, status: true } }),
  ]);
  return { canon, players };
}

// ---------------------------------------------------------------- panel state

export async function getSeatState(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.userId !== userId) throw new SeatError("Personaje no encontrado.");
  await refreshSeatChallenges();
  const faction = c.faction as FactionKey;
  const ladder = ladderFor(faction);
  const now = new Date();
  const jailed = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
  const imprisoned = !!jailed && !jailed.releasedAt;
  const mySeat = isSeatId(c.seat) ? c.seat : null;
  const myOpen = await openChallengeOf(c.id);

  const tiers = [];
  for (const s of ladder) {
    const req = seatRequirements(s.id, { faction, alive: c.status === CharacterStatus.ALIVE, imprisoned, level: c.level, merit: c.notoriety, seat: mySeat });
    const { canon, players } = await holders(s.id);
    const hq = await hqIsland(s.id);
    const atHq = !!hq && hq.id === c.currentIslandId;
    const rows = [];
    for (const a of canon) {
      const visibleHere = !a.locationHidden && a.locationKind !== "sea" && a.currentIslandId === c.currentIslandId;
      const location = a.locationHidden ? "Paradero desconocido" : a.locationKind === "sea" ? "En el mar" : (await islandName(a.currentIslandId)) ?? "Paradero desconocido";
      const busy = actorBusy(a, now) || !!(await openChallengeOf(a.id));
      rows.push({
        kind: "canon" as const, id: a.id, name: a.name, location, here: visibleHere, isMe: false,
        block: seatChallengeBlock({ eligible: req.ok, targetHoldsSeat: true, targetIsSelf: false, sameIsland: visibleHere, atHq, lastChallengeAt: c.lastSeatChallengeAt, targetBusy: busy, hasOpenChallenge: !!myOpen, now }, s.id),
      });
    }
    for (const p of players) {
      const same = p.currentIslandId === c.currentIslandId;
      rows.push({
        kind: "player" as const, id: p.id, name: p.name, location: (await islandName(p.currentIslandId)) ?? "?", here: same, isMe: p.id === c.id,
        block: p.id === c.id ? null : seatChallengeBlock({ eligible: req.ok, targetHoldsSeat: true, targetIsSelf: false, sameIsland: same, atHq, lastChallengeAt: c.lastSeatChallengeAt, targetBusy: !!(await openChallengeOf(p.id)), hasOpenChallenge: !!myOpen, now }, s.id),
      });
    }
    tiers.push({ id: s.id, title: s.title, seats: s.seats, taken: rows.length, hq: s.hq, atHq, requirements: req, holders: rows, vacant: rows.length < s.seats });
  }

  const incoming = await prisma.seatChallenge.findMany({ where: { defenderId: c.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  const outgoing = await prisma.seatChallenge.findMany({ where: { challengerId: c.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  const history = await prisma.seatChallenge.findMany({ where: { faction, status: "DONE" }, orderBy: { updatedAt: "desc" }, take: 6 });
  return {
    faction,
    applies: ladder.length > 0,
    ladderName: LADDER_NAME[faction] ?? null,
    mySeat: mySeat ? { id: mySeat, title: SEATS[mySeat].title } : null,
    islandName: c.currentIsland.name,
    tiers,
    incoming: incoming.map((i) => ({
      id: i.id, seatTitle: SEATS[i.seat as SeatId]?.title ?? i.seat, challengerName: i.challengerName, challengerKind: i.challengerKind, expiresAt: i.expiresAt, islandName: i.islandName,
      mustTravel: i.challengerKind === "player" && !!i.islandId && i.islandId !== c.currentIslandId,
    })),
    outgoing: outgoing.map((o) => ({ id: o.id, seatTitle: SEATS[o.seat as SeatId]?.title ?? o.seat, defenderName: o.defenderName, expiresAt: o.expiresAt })),
    active: myOpen && myOpen.status === "FIGHTING" ? { id: myOpen.id, seatTitle: SEATS[myOpen.seat as SeatId]?.title ?? myOpen.seat, via: myOpen.duelId ? "duel" : "fight", rival: myOpen.challengerId === c.id ? myOpen.defenderName : myOpen.challengerName } : null,
    history: history.map((h) => historyLine(h)),
  };
}

function historyLine(h: SeatChallenge): string {
  const title = SEATS[h.seat as SeatId]?.title ?? h.seat;
  if (h.outcome === "forfeit") return `${h.defenderName} no acudió y perdió el puesto de ${title} ante ${h.challengerName}.`;
  if (h.outcome === "challenger") return `${h.challengerName} venció a ${h.defenderName} y es ${title}.`;
  return `${h.defenderName} defendió su puesto de ${title} ante ${h.challengerName}.`;
}

// ---------------------------------------------------------------- player challenges

async function loadMine(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.userId !== userId) throw new SeatError("Personaje no encontrado.");
  return c;
}

export async function challengeSeat(characterId: string, userId: string, seatRaw: unknown, targetKind: "canon" | "player", targetId: string) {
  if (!isSeatId(seatRaw)) throw new SeatError("Ese puesto no existe.");
  const seat = seatRaw;
  const s = SEATS[seat];
  const c = await loadMine(characterId, userId);
  const jailed = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
  const req = seatRequirements(seat, { faction: c.faction as FactionKey, alive: c.status === CharacterStatus.ALIVE, imprisoned: !!jailed && !jailed.releasedAt, level: c.level, merit: c.notoriety, seat: isSeatId(c.seat) ? c.seat : null });
  const hq = await hqIsland(seat);
  const atHq = !!hq && hq.id === c.currentIslandId;
  const now = new Date();
  const mineOpen = await openChallengeOf(c.id);
  if (await getOpenJointFightFor(c.id)) throw new SeatError("Ya estás metido en una pelea.");
  if (await getOpenDuelFor(c.id)) throw new SeatError("Estás en pleno duelo.");

  if (targetKind === "canon") {
    const a = await prisma.worldActor.findUnique({ where: { id: targetId } });
    if (!a) throw new SeatError("Ese rival no existe.");
    const here = !a.locationHidden && a.locationKind !== "sea" && a.currentIslandId === c.currentIslandId;
    const block = seatChallengeBlock({ eligible: req.ok, targetHoldsSeat: a.seat === seat && a.status === "ACTIVE", targetIsSelf: false, sameIsland: here, atHq, lastChallengeAt: c.lastSeatChallengeAt, targetBusy: actorBusy(a, now) || !!(await openChallengeOf(a.id)), hasOpenChallenge: !!mineOpen, now }, seat);
    if (block) throw new SeatError(block);
    const ch = await prisma.seatChallenge.create({
      data: { seat, faction: s.faction, challengerKind: "player", challengerId: c.id, challengerName: c.name, defenderKind: "canon", defenderId: a.id, defenderName: a.name, status: "FIGHTING", islandId: c.currentIslandId, islandName: c.currentIsland.name },
    });
    try {
      const started = await startJointFight({
        kind: "seat",
        solo: true,
        characterIds: [c.id],
        enemy: { name: a.name, ...seatHolderStats(a.powerLevel), isBoss: true, personality: a.personality ?? undefined, worldActorId: a.id, isActor: true },
        rewards: seatRewards(seat, c.currentIsland.dangerLevel),
        stakes: `Duelo por el puesto de ${s.title}: si ganas, es tuyo${s.below ? ` y ${a.name} pasa a ocupar tu puesto de ${SEATS[s.below].title}` : ` y ${a.name} baja a ${s.demotedTitle}`}. Es a derrota, no a muerte.`,
        context: { challengeId: ch.id },
      });
      await prisma.seatChallenge.update({ where: { id: ch.id }, data: { fightId: started.fightId } });
    } catch (err) {
      await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
      if (err instanceof JointFightError) throw new SeatError(err.message);
      throw err;
    }
    // The holder answers the challenge where it was made and stays there until it is decided.
    await prisma.worldActor.update({ where: { id: a.id }, data: { currentIslandId: c.currentIslandId, locationKind: "island", seaFromIslandId: null, seaToIslandId: null, locationHidden: false, locationUpdatedAt: now, busyUntil: new Date(now.getTime() + 24 * HOUR), currentFocus: `Duelo por su puesto de ${s.title}` } });
    await prisma.character.update({ where: { id: c.id }, data: { lastSeatChallengeAt: now } });
    await postNews(seatDuelHeadline(seat, c.name, a.name), `En ${c.currentIsland.name}, ${c.name} ha exigido a ${a.name} un duelo por su puesto de ${s.title}. ${here ? "" : `${a.name} ha acudido en persona a responder. `}Toda la cadena de mando contiene el aliento.`, SEAT_NEWS_CATEGORY, c.id, "major", { locationName: c.currentIsland.name, islandId: c.currentIslandId });
    invalidateWorldState();
    return { log: [`Desafías a ${a.name} por el puesto de ${s.title}. Describe tu primer movimiento en la pelea.`] };
  }

  const d = await prisma.character.findUnique({ where: { id: targetId } });
  if (!d || d.status === CharacterStatus.DEAD) throw new SeatError("Ese rival no existe.");
  const block = seatChallengeBlock({ eligible: req.ok, targetHoldsSeat: d.seat === seat, targetIsSelf: d.id === c.id, sameIsland: d.currentIslandId === c.currentIslandId, atHq, lastChallengeAt: c.lastSeatChallengeAt, targetBusy: !!(await openChallengeOf(d.id)), hasOpenChallenge: !!mineOpen, now }, seat);
  if (block) throw new SeatError(block);
  if (d.userId === userId) throw new SeatError("Tus propios personajes no pueden disputarse un puesto.");
  await prisma.seatChallenge.create({
    data: { seat, faction: s.faction, challengerKind: "player", challengerId: c.id, challengerName: c.name, defenderKind: "player", defenderId: d.id, defenderName: d.name, status: "PENDING", islandId: c.currentIslandId, islandName: c.currentIsland.name, expiresAt: new Date(now.getTime() + SEAT_RESPONSE_WINDOW_MS) },
  });
  await prisma.character.update({ where: { id: c.id }, data: { lastSeatChallengeAt: now } });
  await postNews(seatDuelHeadline(seat, c.name, d.name), `${c.name} ha retado a ${d.name} en ${c.currentIsland.name}. ${d.name} tiene 24 horas para aceptar el duelo allí; si no se presenta, pierde el puesto de ${s.title}.`, SEAT_NEWS_CATEGORY, c.id, "major", { locationName: c.currentIsland.name, islandId: c.currentIslandId });
  notifyCharacters([d.id], "seat");
  return { log: [`Retas a ${d.name}. Tiene 24 horas para aceptar el duelo en ${c.currentIsland.name}; si no acude, el puesto es tuyo.`] };
}

/** The defender's answer. Refusing (or letting 24 h pass) hands the seat over: a seat is kept by fighting for it. */
export async function respondSeatChallenge(characterId: string, userId: string, challengeId: string, accept: boolean) {
  const me = await loadMine(characterId, userId);
  const ch = await prisma.seatChallenge.findUnique({ where: { id: challengeId } });
  if (!ch || ch.defenderId !== me.id || ch.status !== "PENDING") throw new SeatError("Ese desafío ya no está pendiente.");
  const s = SEATS[ch.seat as SeatId];
  if (!accept) {
    const lines = await applySeatResult(ch, true, "forfeit");
    return { log: [`Rechazas el duelo. Pierdes el puesto de ${s.title}.`, ...lines] };
  }
  if (await getOpenJointFightFor(me.id)) throw new SeatError("Termina antes la pelea en la que estás.");
  if (await getOpenDuelFor(me.id)) throw new SeatError("Termina antes el duelo en el que estás.");
  const now = new Date();

  if (ch.challengerKind === "player") {
    const rival = await prisma.character.findUnique({ where: { id: ch.challengerId } });
    if (!rival || rival.status !== CharacterStatus.ALIVE) {
      await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
      throw new SeatError("Tu retador ya no puede pelear: el desafío se anula.");
    }
    if (rival.currentIslandId !== me.currentIslandId) throw new SeatError(`Para aceptar tenéis que estar en la misma isla: ${rival.name} te espera en ${(await islandName(rival.currentIslandId)) ?? "su isla"}.`);
    if ((await getOpenDuelFor(rival.id)) || (await getOpenJointFightFor(rival.id))) throw new SeatError(`${rival.name} está ocupado en otra pelea; inténtalo en un rato.`);
    const duel = await prisma.duel.create({
      data: { islandId: me.currentIslandId, challengerId: rival.id, opponentId: me.id, status: "ACTIVE", round: 1, challengerHp: rival.maxHp, challengerMaxHp: rival.maxHp, opponentHp: me.maxHp, opponentMaxHp: me.maxHp },
    });
    await prisma.duelMessage.create({ data: { duelId: duel.id, authorCharacterId: null, authorName: "Árbitro", text: `Duelo por el puesto de ${s.title}: ${rival.name} contra ${me.name}. Es a derrota, no a muerte: quien caiga o pulse «Perdí» pierde. Cada uno describe su movimiento.` } });
    await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "FIGHTING", duelId: duel.id } });
    notifyCharacters([rival.id, me.id], "duel");
    return { log: [`Aceptas. El duelo por el puesto de ${s.title} empieza: describe tu movimiento.`] };
  }

  const a = await prisma.worldActor.findUnique({ where: { id: ch.challengerId } });
  if (!a || a.status !== "ACTIVE") {
    await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
    throw new SeatError("Tu retador ya no está en condiciones: el desafío se anula.");
  }
  try {
    const started = await startJointFight({
      kind: "seat",
      solo: true,
      characterIds: [me.id],
      enemy: { name: a.name, ...seatHolderStats(a.powerLevel), isBoss: true, personality: a.personality ?? undefined, worldActorId: a.id, isActor: true },
      rewards: seatRewards(ch.seat as SeatId, me.currentIsland.dangerLevel),
      stakes: `${a.name} viene a por tu puesto de ${s.title}. Si pierdes, se lo queda. Es a derrota, no a muerte.`,
      context: { challengeId: ch.id },
    });
    await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "FIGHTING", fightId: started.fightId, islandId: me.currentIslandId, islandName: me.currentIsland.name } });
  } catch (err) {
    if (err instanceof JointFightError) throw new SeatError(err.message);
    throw err;
  }
  await prisma.worldActor.update({ where: { id: a.id }, data: { currentIslandId: me.currentIslandId, locationKind: "island", seaFromIslandId: null, seaToIslandId: null, locationHidden: false, locationUpdatedAt: now, busyUntil: new Date(now.getTime() + 24 * HOUR), currentFocus: `Duelo por el puesto de ${s.title}` } });
  return { log: [`${a.name} llega a ${me.currentIsland.name}. Defiende tu puesto: describe tu primer movimiento.`] };
}

export async function withdrawSeatChallenge(characterId: string, userId: string, challengeId: string) {
  const me = await loadMine(characterId, userId);
  const ch = await prisma.seatChallenge.findUnique({ where: { id: challengeId } });
  if (!ch || ch.challengerId !== me.id || ch.status !== "PENDING") throw new SeatError("No hay nada que retirar.");
  await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
  return { log: ["Retiras el desafío."] };
}

/** Stepping down: the seat stays empty until someone claims it. */
export async function resignSeat(characterId: string, userId: string) {
  const me = await loadMine(characterId, userId);
  if (!isSeatId(me.seat)) throw new SeatError("No ocupas ningún puesto de mando.");
  if (await openChallengeOf(me.id)) throw new SeatError("Hay un desafío abierto por tu puesto: no puedes renunciar ahora.");
  const s = SEATS[me.seat];
  await prisma.character.update({ where: { id: me.id }, data: { seat: null, seatSince: null, title: me.title === s.title ? null : me.title } });
  await postNews(`${me.name} renuncia a su puesto de ${s.title}`, `${me.name} ha dejado el puesto de ${s.title} por voluntad propia. El puesto queda libre para quien cumpla los requisitos.`, SEAT_NEWS_CATEGORY, me.id, "major");
  invalidateWorldState();
  return { log: [`Renuncias al puesto de ${s.title}.`] };
}

/** An empty seat (someone resigned, a holder fell) can be claimed by whoever meets every requirement, at headquarters. */
export async function claimVacantSeat(characterId: string, userId: string, seatRaw: unknown) {
  if (!isSeatId(seatRaw)) throw new SeatError("Ese puesto no existe.");
  const seat = seatRaw;
  const s = SEATS[seat];
  const c = await loadMine(characterId, userId);
  const jailed = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
  const req = seatRequirements(seat, { faction: c.faction as FactionKey, alive: c.status === CharacterStatus.ALIVE, imprisoned: !!jailed && !jailed.releasedAt, level: c.level, merit: c.notoriety, seat: isSeatId(c.seat) ? c.seat : null });
  if (!req.ok) throw new SeatError("Aún no cumples los requisitos de este puesto.");
  const hq = await hqIsland(seat);
  if (!hq || hq.id !== c.currentIslandId) throw new SeatError(`Un puesto vacante se reclama en ${s.hq}.`);
  const { canon, players } = await holders(seat);
  if (canon.length + players.length >= s.seats) throw new SeatError("No hay ningún puesto libre: tendrás que desafiar a quien lo ocupa.");
  await applyChanges([{ who: { kind: "player", id: c.id, seat: isSeatId(c.seat) ? c.seat : null }, seat, title: s.title }], c.name);
  await postNews(`${c.name} es nombrado ${s.title}`, `Con el puesto vacante, ${c.name} lo ha reclamado en ${s.hq} y cumple todo lo que se exige. Desde hoy es ${s.title}.`, SEAT_NEWS_CATEGORY, c.id, "major", { locationName: hq.name, islandId: hq.id });
  return { log: [`Eres ${s.title}.`] };
}

// ---------------------------------------------------------------- results

async function applyChanges(changes: SeatChange[], winnerName: string): Promise<void> {
  const now = new Date();
  for (const ch of changes) {
    if (ch.who.kind === "player") {
      const p = await prisma.character.findUnique({ where: { id: ch.who.id } });
      if (!p) continue;
      const oldTitle = isSeatId(p.seat) ? SEATS[p.seat].title : null;
      const keepTitle = p.title && p.title !== oldTitle ? p.title : null;
      await prisma.character.update({ where: { id: p.id }, data: { seat: ch.seat, seatSince: ch.seat ? now : null, title: ch.seat ? SEATS[ch.seat].title : keepTitle } });
      continue;
    }
    const a = await prisma.worldActor.findUnique({ where: { id: ch.who.id } });
    if (!a) continue;
    const seat = ch.seat;
    const faction = a.factionType;
    let role = a.role;
    let rankLabel = ch.title ?? a.rankLabel;
    if (seat === "ADMIRAL" || seat === "FLEET_ADMIRAL") role = "ADMIRAL";
    else if (seat === "GOROSEI") role = "GOROSEI";
    else if (seat) role = "REVOLUTIONARY_COMMANDER";
    else if (faction === "MARINE") {
      role = "MARINE_GENERAL";
      rankLabel = `${ch.title} (destituido por ${winnerName})`;
    } else if (a.role === "GOROSEI") {
      role = "NOTABLE_CIVILIAN";
      rankLabel = `Ex-Gorosei (destituido por ${winnerName})`;
    } else rankLabel = `${ch.title} (destituido por ${winnerName})`;
    await prisma.worldActor.update({ where: { id: a.id }, data: { seat, role, rankLabel, busyUntil: null, currentFocus: seat ? `Ocupa el puesto de ${SEATS[seat].title}` : "Recién destituido" } });
  }
  invalidateWorldState();
}

async function refOf(kind: string, id: string): Promise<SeatHolderRef> {
  if (kind === "player") {
    const p = await prisma.character.findUnique({ where: { id }, select: { seat: true } });
    return { kind: "player", id, seat: isSeatId(p?.seat) ? (p!.seat as SeatId) : null };
  }
  const a = await prisma.worldActor.findUnique({ where: { id }, select: { seat: true } });
  return { kind: "canon", id, seat: isSeatId(a?.seat) ? (a!.seat as SeatId) : null };
}

/** Settles one challenge exactly once and publishes it. */
export async function applySeatResult(ch: SeatChallenge, challengerWon: boolean, how: "fight" | "duel" | "forfeit" | "judge", reason?: string): Promise<string[]> {
  const outcome = how === "forfeit" ? "forfeit" : challengerWon ? "challenger" : "defender";
  const claimed = await prisma.seatChallenge.updateMany({ where: { id: ch.id, status: { in: OPEN } }, data: { status: "DONE", outcome } });
  if (claimed.count === 0) return [];
  const s = SEATS[ch.seat as SeatId];
  const [challenger, defender] = await Promise.all([refOf(ch.challengerKind, ch.challengerId), refOf(ch.defenderKind, ch.defenderId)]);
  const where = ch.islandName ? { locationName: ch.islandName, islandId: ch.islandId ?? undefined } : undefined;
  const playerId = ch.challengerKind === "player" ? ch.challengerId : ch.defenderKind === "player" ? ch.defenderId : undefined;
  if (ch.defenderKind === "player") await prisma.character.update({ where: { id: ch.defenderId }, data: { lastSeatDefenseAt: new Date() } }).catch(() => {});
  for (const k of [ch.challengerKind === "canon" ? ch.challengerId : null, ch.defenderKind === "canon" ? ch.defenderId : null]) if (k) await prisma.worldActor.update({ where: { id: k }, data: { busyUntil: null, currentFocus: null } }).catch(() => {});

  if (!challengerWon) {
    await postNews(`${ch.defenderName} conserva su puesto de ${s.title}`, `${ch.defenderName} ha derrotado a ${ch.challengerName}${ch.islandName ? ` en ${ch.islandName}` : ""} y sigue siendo ${s.title}.${reason ? ` ${reason}` : ""}`, SEAT_NEWS_CATEGORY, playerId, "major", where);
    notifyCharacters([ch.challengerId, ch.defenderId], "seat");
    return [`${ch.defenderName} conserva el puesto de ${s.title}.`];
  }
  if (defender.seat !== ch.seat) {
    await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
    return ["El puesto ya había cambiado de manos: el desafío queda sin efecto."];
  }
  const changes = seatSwap(ch.seat as SeatId, challenger, defender, true);
  await applyChanges(changes, ch.challengerName);
  const loserChange = changes[1];
  const loserFate = loserChange.seat ? `pasa a ser ${SEATS[loserChange.seat].title}` : `baja a ${SEATS[ch.seat as SeatId].demotedTitle}`;
  const headline = how === "forfeit" ? `${ch.defenderName} no se presenta: ${ch.challengerName} es el nuevo ${s.title}` : `${ch.challengerName} derrota a ${ch.defenderName} y es el nuevo ${s.title}`;
  await postNews(headline, `${how === "forfeit" ? `${ch.defenderName} no aceptó el duelo a tiempo` : `${ch.challengerName} venció a ${ch.defenderName}${ch.islandName ? ` en ${ch.islandName}` : ""}`}. Desde hoy ${ch.challengerName} es ${s.title}; ${ch.defenderName} ${loserFate}.${reason ? ` ${reason}` : ""}`, SEAT_NEWS_CATEGORY, playerId, "major", where);
  notifyCharacters([ch.challengerId, ch.defenderId], "seat");
  return [`¡${ch.challengerName} es el nuevo ${s.title}! ${ch.defenderName} ${loserFate}.`];
}

export async function handleSeatFightSettled(contextJson: string, outcome: "victory" | "defeat" | null): Promise<string[]> {
  const { challengeId } = parse<{ challengeId?: string }>(contextJson, {});
  if (!challengeId) return [];
  const ch = await prisma.seatChallenge.findUnique({ where: { id: challengeId } });
  if (!ch || ch.status !== "FIGHTING") return [];
  const playerIsChallenger = ch.challengerKind === "player";
  if (outcome === null) {
    if (playerIsChallenger) {
      await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
      if (ch.defenderKind === "canon") await prisma.worldActor.update({ where: { id: ch.defenderId }, data: { busyUntil: null, currentFocus: null } }).catch(() => {});
      return ["Te retiras del duelo: el puesto sigue como estaba."];
    }
    return applySeatResult(ch, true, "forfeit");
  }
  const playerWon = outcome === "victory";
  return applySeatResult(ch, playerIsChallenger ? playerWon : !playerWon, "fight");
}

/** Called when a friendly duel ends (knockout or "Perdí"). */
export async function onSeatDuelFinished(duelId: string, winnerId: string | null): Promise<string[]> {
  const ch = await prisma.seatChallenge.findFirst({ where: { duelId, status: "FIGHTING" } });
  if (!ch || !winnerId) return [];
  return applySeatResult(ch, winnerId === ch.challengerId, "duel");
}

// ---------------------------------------------------------------- the world moves on its own

/** Deadlines: an unanswered challenge costs the seat; a fight or duel that was abandoned cancels the challenge. */
export async function refreshSeatChallenges(now = new Date()): Promise<void> {
  const open = await prisma.seatChallenge.findMany({ where: { status: { in: OPEN } } });
  for (const ch of open) {
    if (ch.status === "PENDING" && ch.expiresAt && ch.expiresAt <= now) await applySeatResult(ch, true, "forfeit");
    else if (ch.status === "FIGHTING" && ch.fightId) {
      const f = await prisma.jointFight.findUnique({ where: { id: ch.fightId }, select: { status: true } });
      if (!f || f.status === "CANCELLED") await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
    } else if (ch.status === "FIGHTING" && ch.duelId) {
      const d = await prisma.duel.findUnique({ where: { id: ch.duelId }, select: { status: true, winnerId: true } });
      if (!d || d.status === "CANCELLED" || d.status === "DECLINED") await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
      else if (d.status === "FINISHED" && d.winnerId) await applySeatResult(ch, d.winnerId === ch.challengerId, "duel");
    } else if (ch.status === "ANNOUNCED" && ch.resolveAt && ch.resolveAt <= now) await resolveCanonDuel(ch);
  }
}

function fighterOf(a: WorldActor) {
  const abilities = a.abilitiesJson ? parse<string[]>(a.abilitiesJson, []).slice(0, 6).join("; ") : "";
  return { name: a.name, level: a.powerLevel, atk: a.powerLevel * 10, def: a.powerLevel * 9, kit: abilities || undefined };
}

async function resolveCanonDuel(ch: SeatChallenge): Promise<void> {
  const [a, b] = await Promise.all([prisma.worldActor.findUnique({ where: { id: ch.challengerId } }), prisma.worldActor.findUnique({ where: { id: ch.defenderId } })]);
  if (!a || !b || a.status !== "ACTIVE" || b.status !== "ACTIVE") {
    await prisma.seatChallenge.update({ where: { id: ch.id }, data: { status: "CANCELLED" } });
    return;
  }
  const v = await judgeMatch(fighterOf(a), fighterOf(b), `Duelo por el puesto de ${SEATS[ch.seat as SeatId]?.title}: ${a.name} desafía a ${b.name}, que lo ocupa. Es a derrota, no a muerte.`);
  await applySeatResult(ch, v.winner === "a", "judge", v.reason && v.reason !== "stub" ? v.reason : undefined);
}

async function startCanonEvent(now: Date): Promise<void> {
  const seed = `seat:${Math.floor(now.getTime() / HOUR)}`;
  const actors = await prisma.worldActor.findMany({ where: { status: "ACTIVE" } });
  const busyIds = new Set((await prisma.seatChallenge.findMany({ where: { status: { in: OPEN } } })).flatMap((c) => [c.challengerId, c.defenderId]));
  const free = (a: WorldActor) => !busyIds.has(a.id) && !actorBusy(a, now);
  const challengersFor = (seat: SeatId) => {
    const s = SEATS[seat];
    return actors.filter((a) => free(a) && (s.below ? a.seat === s.below : isEntryAspirant(seat, a))).sort((x, y) => y.powerLevel - x.powerLevel);
  };

  // A canon character comes for a player's seat first: the players are who the world should test.
  const players = await prisma.character.findMany({ where: { seat: { not: null }, status: CharacterStatus.ALIVE } });
  const due = players.filter((p) => !busyIds.has(p.id) && isSeatId(p.seat) && (!p.lastSeatDefenseAt || now.getTime() - p.lastSeatDefenseAt.getTime() >= PLAYER_DEFENSE_GAP_MS) && (!p.seatSince || now.getTime() - p.seatSince.getTime() >= 12 * HOUR));
  for (const p of due) {
    const seat = p.seat as SeatId;
    const pool = challengersFor(seat).slice(0, 3);
    const rival = pickBySeed(pool, `${seed}:${p.id}`);
    if (!rival) continue;
    const s = SEATS[seat];
    const where = await islandName(p.currentIslandId);
    await prisma.seatChallenge.create({
      data: { seat, faction: s.faction, challengerKind: "canon", challengerId: rival.id, challengerName: rival.name, defenderKind: "player", defenderId: p.id, defenderName: p.name, status: "PENDING", islandId: p.currentIslandId, islandName: where, expiresAt: new Date(now.getTime() + SEAT_RESPONSE_WINDOW_MS) },
    });
    await prisma.character.update({ where: { id: p.id }, data: { lastSeatDefenseAt: now } });
    await postNews(seatDuelHeadline(seat, rival.name, p.name), `${rival.name} no acepta que ${p.name} sea ${s.title} y le ha retado en público. ${p.name} tiene 24 horas para aceptar el duelo; si no lo hace, perderá el puesto.`, SEAT_NEWS_CATEGORY, p.id, "major", where ? { locationName: where, islandId: p.currentIslandId } : undefined);
    notifyCharacters([p.id], "seat");
    return;
  }

  // Otherwise two canon characters settle it among themselves.
  const options: { seat: SeatId; challenger: WorldActor; defender: WorldActor }[] = [];
  for (const seat of Object.keys(SEATS) as SeatId[]) {
    const defenders = actors.filter((a) => a.seat === seat && free(a));
    const challenger = challengersFor(seat)[0];
    if (challenger && defenders.length) options.push({ seat, challenger, defender: pickBySeed(defenders, `${seed}:${seat}`)! });
  }
  const pick = pickBySeed(options, seed);
  if (!pick) return;
  const s = SEATS[pick.seat];
  const hq = await hqIsland(pick.seat);
  const resolveAt = new Date(now.getTime() + CANON_SEAT_DUEL_DELAY_MS);
  await prisma.seatChallenge.create({
    data: { seat: pick.seat, faction: s.faction, challengerKind: "canon", challengerId: pick.challenger.id, challengerName: pick.challenger.name, defenderKind: "canon", defenderId: pick.defender.id, defenderName: pick.defender.name, status: "ANNOUNCED", islandId: hq?.id ?? null, islandName: hq?.name ?? null, resolveAt },
  });
  for (const a of [pick.challenger, pick.defender]) {
    await prisma.worldActor.update({ where: { id: a.id }, data: { ...(hq ? { currentIslandId: hq.id, locationKind: "island", seaFromIslandId: null, seaToIslandId: null, locationHidden: false, locationUpdatedAt: now } : {}), busyUntil: resolveAt, currentFocus: `Duelo por el puesto de ${s.title}` } });
  }
  await postNews(seatDuelHeadline(pick.seat, pick.challenger.name, pick.defender.name), `${pick.challenger.name} ha retado públicamente a ${pick.defender.name} por el puesto de ${s.title}${hq ? `. El duelo se celebrará en ${hq.name}` : ""}. En unas horas se sabrá quién manda.`, "Eventos mundiales", undefined, "major", hq ? { locationName: hq.name, islandId: hq.id } : undefined);
  invalidateWorldState();
}

let ticking = false;

/** Fire-and-forget from the world tick. */
export async function tickFactionSeats(now = new Date()): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await refreshSeatChallenges(now);
    const last = await prisma.seatChallenge.findFirst({ where: { challengerKind: "canon" }, orderBy: { createdAt: "desc" } });
    if (last && now.getTime() - last.createdAt.getTime() < CANON_SEAT_EVENT_GAP_MS) return;
    await startCanonEvent(now);
  } catch {
    // the world tick never fails a request
  } finally {
    ticking = false;
  }
}

/** Test/owner helper: start a world seat event right now, ignoring the gap. */
export async function startCanonSeatEventNow(now = new Date()): Promise<void> {
  await startCanonEvent(now);
}

/** Resolve an announced canon duel now (tests and the owner). */
export async function resolveCanonDuelNow(challengeId: string): Promise<void> {
  const ch = await prisma.seatChallenge.findUnique({ where: { id: challengeId } });
  if (ch && ch.status === "ANNOUNCED") await resolveCanonDuel(ch);
}

/** Seat lines for the AI's world facts. */
export async function seatHoldersSummary(): Promise<string[]> {
  const [actors, players] = await Promise.all([
    prisma.worldActor.findMany({ where: { seat: { not: null }, status: "ACTIVE" }, select: { name: true, seat: true } }),
    prisma.character.findMany({ where: { seat: { not: null }, status: { not: CharacterStatus.DEAD } }, select: { name: true, seat: true } }),
  ]);
  const out: string[] = [];
  for (const id of Object.keys(SEATS) as SeatId[]) {
    const names = [...actors.filter((a) => a.seat === id).map((a) => a.name), ...players.filter((p) => p.seat === id).map((p) => `${p.name} (jugador)`)];
    if (names.length) out.push(`${SEATS[id].title}: ${names.join(", ")}`);
  }
  return out;
}
