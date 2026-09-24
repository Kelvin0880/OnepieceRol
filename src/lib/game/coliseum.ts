import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import {
  COLISEUM_ISLAND_NAME,
  KIND_LABELS,
  REGISTRATION_LEAD_MS,
  ROUND_INTERVAL_MS,
  bracketSize,
  canRegister,
  choosePrize,
  drawBracket,
  gladiatorCombatant,
  gladiatorNames,
  nextAction,
  pickKind,
  roundName,
  runBout,
  totalRounds,
  type CompetitionKind,
  type PrizeSpec,
  type TournamentStatus,
} from "../engine/coliseum";
import { fruitBlackMarketPrice } from "../engine/economy";
import { intellectTacticEdge } from "../engine/attributes";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";
import { toCombatant } from "./derive";
import { postNews } from "./death-resolution";
import { grantXp } from "./xp";
import { grantCatalogFruit, grantWeapon } from "./inventory";
import { getOpenDuelFor } from "./duel";
import { getOpenJointFightFor } from "./joint-fight";
import { notifyCharacters } from "../realtime";
import { narrateColiseumRound } from "../ai/narrate";
import { classifyPlayerAction } from "../ai/classify-action";
import { logError } from "../log-error";

export class ColiseumError extends Error {}

const CATEGORY = "Coliseo";
const STRATEGY_MAX = 300;
const CONSOLATION_BERRIES = 60_000;

interface Match {
  a: string;
  b: string;
  winner?: string;
  aHp?: number;
  bHp?: number;
  walkover?: boolean;
}

const parsePrize = (json: string) => JSON.parse(json) as PrizeSpec;
const parseBracket = (json: string) => JSON.parse(json) as Match[][];

let ticking = false;

/** The lazy calendar tick: announces, opens, advances and closes tournaments. One at a time per process; never throws. */
export async function tickColiseum(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    for (let guard = 0; guard < 8; guard++) {
      const step = await coliseumStep();
      if (!step) break;
    }
  } catch (err) {
    await logError("coliseum/tick", err);
  } finally {
    ticking = false;
  }
}

/** Runs at most one due transition. Returns false when nothing was due. */
export async function coliseumStep(now = Date.now()): Promise<boolean> {
  const [open, clock] = await Promise.all([
    prisma.tournament.findFirst({ where: { status: { in: ["ANNOUNCED", "RUNNING"] } }, orderBy: { announcedAt: "desc" } }),
    prisma.worldClock.findUnique({ where: { id: 1 } }),
  ]);
  const action = nextAction(
    { status: (open?.status as TournamentStatus | undefined) ?? null, startsAtMs: open?.startsAt.getTime(), roundEndsAtMs: open?.roundEndsAt?.getTime(), lastTournamentAtMs: clock?.lastTournamentAt?.getTime() ?? null },
    now
  );
  if (action === "announce") await announceTournament(now);
  else if (action === "start" && open) await startTournament(open.id);
  else if (action === "resolve_round" && open) await resolveRound(open.id);
  else return false;
  return true;
}

async function dressrosa() {
  return prisma.island.findFirst({ where: { name: COLISEUM_ISLAND_NAME } });
}

export async function announceTournament(now = Date.now(), forced?: { kind?: CompetitionKind }) {
  const isle = await dressrosa();
  if (!isle) return null;
  const rng = liveRng();
  const here = await prisma.character.findMany({ where: { currentIslandId: isle.id, status: "ALIVE" }, select: { level: true } });
  const avgLevel = here.length ? Math.round(here.reduce((s, c) => s + c.level, 0) / here.length) : isle.minLevelToEnter;
  const kind = forced?.kind ?? pickKind(rng);
  const prize = choosePrize(rng, kind, avgLevel, DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton).map((f) => f.name));
  const startsAt = new Date(now + REGISTRATION_LEAD_MS);
  const t = await prisma.tournament.create({ data: { kind, status: "ANNOUNCED", prizeJson: JSON.stringify(prize), startsAt } });
  await prisma.worldClock.upsert({ where: { id: 1 }, update: { lastTournamentAt: new Date(now) }, create: { id: 1, lastTournamentAt: new Date(now) } });
  const hours = Math.round(REGISTRATION_LEAD_MS / 3_600_000);
  await postNews(
    `El Coliseo de Dressrosa convoca el ${KIND_LABELS[kind].toLowerCase()}`,
    `Premio para el campeón: ${prize.label}. La inscripción está abierta durante ${hours} horas y solo pueden apuntarse quienes estén en Dressrosa cuando se cierre. Los emparejamientos serán totalmente al azar, gladiadores del reino incluidos, y el torneo no es letal.`,
    CATEGORY,
    undefined,
    "major",
    { locationName: COLISEUM_ISLAND_NAME, islandId: isle.id }
  );
  return t;
}

async function participantIds(tournamentId: string): Promise<string[]> {
  const rows = await prisma.tournamentEntry.findMany({ where: { tournamentId, characterId: { not: null } }, select: { characterId: true } });
  return rows.flatMap((r) => (r.characterId ? [r.characterId] : []));
}

export async function startTournament(tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: { entries: true } });
  if (!t || t.status !== "ANNOUNCED") return;
  const isle = await dressrosa();
  if (!isle) return;
  const rng = liveRng();
  const humans: { entryId: string; level: number }[] = [];
  for (const e of t.entries.filter((x) => x.status === "REGISTERED" && x.characterId)) {
    const c = await prisma.character.findUnique({ where: { id: e.characterId! } });
    const busy = c ? !!(await getOpenDuelFor(c.id)) || !!(await getOpenJointFightFor(c.id)) : true;
    if (c && c.status === "ALIVE" && c.currentIslandId === isle.id && !busy) {
      humans.push({ entryId: e.id, level: c.level });
    } else {
      await prisma.tournamentEntry.update({ where: { id: e.id }, data: { status: "WITHDRAWN" } });
      if (c) await prisma.gameLogEntry.create({ data: { characterId: c.id, kind: "coliseum", text: "Te inscribiste al torneo del Coliseo, pero no estabas en Dressrosa cuando se cerró la inscripción: quedas fuera." } });
    }
  }
  if (humans.length === 0) {
    await prisma.tournament.update({ where: { id: t.id }, data: { status: "CANCELLED", finishedAt: new Date() } });
    await postNews("El Coliseo cierra sin inscritos", "Nadie se presentó al torneo anunciado y los organizadores lo aplazan hasta la próxima convocatoria.", CATEGORY, undefined, "normal", { locationName: COLISEUM_ISLAND_NAME, islandId: isle.id });
    return;
  }
  const size = bracketSize(humans.length);
  const avgLevel = Math.round(humans.reduce((s, h) => s + h.level, 0) / humans.length);
  const named = await prisma.worldActor.findMany({ where: { currentIslandId: isle.id, status: "ACTIVE", locationHidden: false }, select: { name: true }, take: 4 });
  const namedPool = named.map((n) => n.name);
  const need = size - humans.length;
  const namedUse = namedPool.slice(0, Math.min(namedPool.length, Math.ceil(need / 3)));
  const generic = gladiatorNames(rng, need - namedUse.length, new Set(namedPool));
  const npcRows = [...namedUse.map((n) => ({ n, named: true })), ...generic.map((n) => ({ n, named: false }))];
  for (const r of npcRows) {
    await prisma.tournamentEntry.create({ data: { tournamentId: t.id, name: r.n, isNpc: true, npcLevel: avgLevel, npcNamed: r.named, status: "ACTIVE" } });
  }
  await prisma.tournamentEntry.updateMany({ where: { tournamentId: t.id, status: "REGISTERED" }, data: { status: "ACTIVE" } });
  const entries = await prisma.tournamentEntry.findMany({ where: { tournamentId: t.id, status: "ACTIVE" } });
  const pairs = drawBracket(rng, entries.map((e) => e.id));
  const round1: Match[] = pairs.map(([a, b]) => ({ a, b }));
  await prisma.tournament.update({ where: { id: t.id }, data: { status: "RUNNING", size, round: 1, roundEndsAt: new Date(Date.now() + ROUND_INTERVAL_MS), bracketJson: JSON.stringify([round1]) } });
  const nameOf = new Map(entries.map((e) => [e.id, e.name]));
  await postNews(
    `Comienza el ${KIND_LABELS[t.kind as CompetitionKind].toLowerCase()} del Coliseo`,
    `${size} gladiadores, ${humans.length} de ellos aventureros. ${roundName(size, 1)}: ${round1.map((m) => `${nameOf.get(m.a)} contra ${nameOf.get(m.b)}`).join("; ")}. Premio: ${parsePrize(t.prizeJson).label}.`,
    CATEGORY,
    undefined,
    "major",
    { locationName: COLISEUM_ISLAND_NAME, islandId: isle.id }
  );
  notifyCharacters(await participantIds(t.id), "coliseum");
}

async function humanFighter(characterId: string, isleId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { devilFruit: true, equippedWeapon: true, styles: true, ownedWeapons: { where: { wielded: true } } } });
  if (!c || c.status !== "ALIVE" || c.currentIslandId !== isleId) return null;
  return c;
}

async function strategyTactic(text: string | null, intellect: number): Promise<number> {
  const edge = intellectTacticEdge(intellect);
  if (!text || !text.trim()) return edge;
  try {
    const r = await classifyPlayerAction(text, ["engage"], {});
    return r.tacticModifier + edge;
  } catch {
    return edge;
  }
}

export async function resolveRound(tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: { entries: true } });
  if (!t || t.status !== "RUNNING") return;
  const isle = await dressrosa();
  if (!isle) return;
  const rng = liveRng();
  const rounds = parseBracket(t.bracketJson);
  const current = rounds[t.round - 1];
  const byId = new Map(t.entries.map((e) => [e.id, e]));
  const label = roundName(t.size, t.round);
  const prize = parsePrize(t.prizeJson);
  const narrationMatches: { a: string; b: string; winner: string; aHpPct: number; bHpPct: number; walkover?: boolean }[] = [];

  for (const m of current) {
    const ea = byId.get(m.a)!;
    const eb = byId.get(m.b)!;
    const side = async (e: typeof ea) => {
      if (e.isNpc) return { present: true, combatant: gladiatorCombatant(e.name, e.npcLevel ?? 10, e.npcNamed), tactic: 0 };
      const c = e.characterId ? await humanFighter(e.characterId, isle.id) : null;
      if (!c) return { present: false, combatant: null, tactic: 0 };
      const base = toCombatant(c);
      return { present: true, combatant: { ...base, hp: base.maxHp }, tactic: await strategyTactic(e.strategy, c.intellect) };
    };
    const [sa, sb] = await Promise.all([side(ea), side(eb)]);
    let winnerEntry: typeof ea;
    if (!sa.present || !sb.present) {
      winnerEntry = sa.present ? ea : sb.present ? eb : rng() < 0.5 ? ea : eb;
      m.walkover = true;
      m.aHp = 100;
      m.bHp = 100;
    } else {
      const bout = runBout(rng, sa.combatant!, sb.combatant!, sa.tactic, sb.tactic);
      winnerEntry = bout.winner === "a" ? ea : eb;
      m.aHp = bout.aHpPct;
      m.bHp = bout.bHpPct;
    }
    m.winner = winnerEntry.id;
    narrationMatches.push({ a: ea.name, b: eb.name, winner: winnerEntry.name, aHpPct: m.aHp ?? 0, bHpPct: m.bHp ?? 0, walkover: m.walkover });
  }

  const winners = current.map((m) => m.winner!);
  const losers = current.flatMap((m) => [m.a, m.b].filter((id) => id !== m.winner));
  await prisma.tournamentEntry.updateMany({ where: { id: { in: losers } }, data: { status: "ELIMINATED", roundOut: t.round, strategy: null } });
  await prisma.tournamentEntry.updateMany({ where: { id: { in: winners } }, data: { strategy: null } });

  // Every human is told what happened to them, and winners earn experience.
  for (const m of current) {
    for (const id of [m.a, m.b]) {
      const e = byId.get(id)!;
      if (!e.characterId) continue;
      const won = m.winner === id;
      const other = byId.get(id === m.a ? m.b : m.a)!;
      const text = m.walkover
        ? won ? `Coliseo, ${label}: ${other.name} no se presentó y avanzas sin pelear.` : `Coliseo, ${label}: no estabas en Dressrosa cuando te tocó combatir contra ${other.name}: quedas eliminado.`
        : won ? `Coliseo, ${label}: vences a ${other.name} y pasas de ronda.` : `Coliseo, ${label}: ${other.name} te vence y quedas eliminado del torneo.`;
      await prisma.gameLogEntry.create({ data: { characterId: e.characterId, kind: "coliseum", text } });
      if (won) {
        const c = await prisma.character.findUnique({ where: { id: e.characterId } });
        if (c) {
          const xp = await grantXp(c.experience, c.level, 25 + 15 * t.round);
          await prisma.character.update({ where: { id: c.id }, data: { experience: xp.xp, level: xp.level } });
        }
      }
    }
  }

  const finalRound = winners.length === 1;
  const champion = finalRound ? byId.get(winners[0])! : null;
  const story = await narrateColiseumRound({ roundLabel: label, matches: narrationMatches, prize: prize.label, finalRound, champion: champion?.name }, { tournamentId: t.id });
  await postNews(finalRound ? `${champion!.name} es el campeón del Coliseo` : `Coliseo de Dressrosa: ${label}`, story, CATEGORY, undefined, finalRound ? "major" : "normal", { locationName: COLISEUM_ISLAND_NAME, islandId: isle.id });

  if (finalRound && champion) {
    const finalist = current[0];
    const runnerUpId = finalist.a === champion.id ? finalist.b : finalist.a;
    await prisma.tournamentEntry.update({ where: { id: champion.id }, data: { status: "CHAMPION" } });
    await prisma.tournament.update({ where: { id: t.id }, data: { status: "FINISHED", championName: champion.name, championEntryId: champion.id, finishedAt: new Date(), bracketJson: JSON.stringify(rounds) } });
    if (champion.characterId) await awardPrize(champion.characterId, prize);
    const runner = byId.get(runnerUpId);
    if (runner?.characterId) {
      const c = await prisma.character.findUnique({ where: { id: runner.characterId } });
      if (c) {
        await prisma.character.update({ where: { id: c.id }, data: { berries: c.berries + CONSOLATION_BERRIES } });
        await prisma.gameLogEntry.create({ data: { characterId: c.id, kind: "coliseum", text: `Subcampeón del Coliseo: recibes ฿ ${CONSOLATION_BERRIES.toLocaleString("es-ES")} de consolación.` } });
      }
    }
    notifyCharacters(await participantIds(t.id), "coliseum");
    return;
  }

  // Next round: a fresh random draw among the survivors.
  const pairs = drawBracket(rng, winners);
  rounds.push(pairs.map(([a, b]) => ({ a, b })));
  await prisma.tournament.update({ where: { id: t.id }, data: { round: t.round + 1, roundEndsAt: new Date(Date.now() + ROUND_INTERVAL_MS), bracketJson: JSON.stringify(rounds) } });
  notifyCharacters(await participantIds(t.id), "coliseum");
}

/** The champion's prize lands in their inventory (weapon, fruit) or purse, and is announced with its real name. */
async function awardPrize(characterId: string, prize: PrizeSpec): Promise<void> {
  let text: string;
  if (prize.kind === "weapon" && prize.weapon) {
    const name = await grantWeapon(characterId, { ...prize.weapon, basePrice: 20_000 });
    text = `¡Campeón del Coliseo! Te llevas ${name} (+${prize.weapon.atkBonus} ATQ): ya está en tu Inventario, listo para equipar.`;
  } else if (prize.kind === "fruit" && prize.fruitName) {
    const name = await grantCatalogFruit(characterId, prize.fruitName);
    if (name) {
      text = `¡Campeón del Coliseo! Tu premio es la ${name}. Está en tu Mochila: tú decides si te la comes, la vendes o la guardas.`;
    } else {
      const c = await prisma.character.findUnique({ where: { id: characterId } });
      const cash = 200_000 + fruitBlackMarketPrice("RARE") / 2;
      if (c) await prisma.character.update({ where: { id: c.id }, data: { berries: c.berries + cash } });
      text = `¡Campeón del Coliseo! Tu premio era la ${prize.fruitName}, pero tu mochila estaba llena: los organizadores te pagan su valor, ฿ ${cash.toLocaleString("es-ES")}.`;
    }
  } else {
    const c = await prisma.character.findUnique({ where: { id: characterId } });
    if (c) await prisma.character.update({ where: { id: c.id }, data: { berries: c.berries + (prize.berries ?? 0) } });
    text = `¡Campeón del Coliseo! Cobras el premio: ฿ ${(prize.berries ?? 0).toLocaleString("es-ES")}.`;
  }
  await prisma.gameLogEntry.create({ data: { characterId, kind: "coliseum", text } });
}

export async function registerForTournament(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.userId !== userId) throw new ColiseumError("Personaje no encontrado.");
  const t = await prisma.tournament.findFirst({ where: { status: { in: ["ANNOUNCED", "RUNNING"] } }, orderBy: { announcedAt: "desc" } });
  const existing = t ? await prisma.tournamentEntry.findFirst({ where: { tournamentId: t.id, characterId, status: { not: "WITHDRAWN" } } }) : null;
  const busy = !!(await getOpenDuelFor(c.id)) || !!(await getOpenJointFightFor(c.id));
  const check = canRegister({ onDressrosa: c.currentIsland.name === COLISEUM_ISLAND_NAME, alive: c.status === "ALIVE", busy, status: (t?.status as TournamentStatus | undefined) ?? null, alreadyRegistered: !!existing });
  if (!check.ok || !t) throw new ColiseumError(check.ok ? "No hay torneo." : check.reason);
  await prisma.tournamentEntry.create({ data: { tournamentId: t.id, characterId, name: c.name, status: "REGISTERED" } });
  await prisma.gameLogEntry.create({ data: { characterId, kind: "coliseum", text: "Te inscribes al torneo del Coliseo de Dressrosa. Debes seguir en la isla cuando se cierre la inscripción." } });
  return { message: "Inscrito. Quédate en Dressrosa: el sorteo se hace al cerrar la inscripción." };
}

export async function withdrawFromTournament(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c || c.userId !== userId) throw new ColiseumError("Personaje no encontrado.");
  const t = await prisma.tournament.findFirst({ where: { status: "ANNOUNCED" }, orderBy: { announcedAt: "desc" } });
  if (!t) throw new ColiseumError("Solo puedes retirarte mientras la inscripción está abierta.");
  const res = await prisma.tournamentEntry.updateMany({ where: { tournamentId: t.id, characterId, status: "REGISTERED" }, data: { status: "WITHDRAWN" } });
  if (res.count === 0) throw new ColiseumError("No estás inscrito.");
  return { message: "Te retiras del torneo." };
}

export async function submitStrategy(characterId: string, userId: string, text: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c || c.userId !== userId) throw new ColiseumError("Personaje no encontrado.");
  const t = await prisma.tournament.findFirst({ where: { status: "RUNNING" } });
  if (!t) throw new ColiseumError("No hay ningún torneo en marcha.");
  const clean = text.trim().slice(0, STRATEGY_MAX);
  if (!clean) throw new ColiseumError("Escribe cómo piensas afrontar tu próximo combate.");
  const rounds = parseBracket(t.bracketJson);
  const current = rounds[t.round - 1] ?? [];
  const entry = await prisma.tournamentEntry.findFirst({ where: { tournamentId: t.id, characterId, status: "ACTIVE" } });
  if (!entry || !current.some((m) => m.a === entry.id || m.b === entry.id)) throw new ColiseumError("No estás combatiendo en esta ronda.");
  await prisma.tournamentEntry.update({ where: { id: entry.id }, data: { strategy: clean } });
  return { message: "Estrategia guardada para tu próximo combate." };
}

/** What the Coliseum panel and the play page need: the calendar, the prize, the bracket and this character's place in it. */
export async function getColiseumState(characterId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c) return null;
  const t =
    (await prisma.tournament.findFirst({ where: { status: { in: ["ANNOUNCED", "RUNNING"] } }, orderBy: { announcedAt: "desc" }, include: { entries: true } })) ??
    (await prisma.tournament.findFirst({ where: { status: "FINISHED", finishedAt: { gt: new Date(Date.now() - 6 * 3_600_000) } }, orderBy: { finishedAt: "desc" }, include: { entries: true } }));
  const onDressrosa = c.currentIsland.name === COLISEUM_ISLAND_NAME;
  const lastFinished = await prisma.tournament.findFirst({ where: { status: "FINISHED" }, orderBy: { finishedAt: "desc" } });
  if (!t) return { tournament: null, onDressrosa, lastChampion: lastFinished?.championName ?? null };
  const byId = new Map(t.entries.map((e) => [e.id, e]));
  const rounds = parseBracket(t.bracketJson);
  const mine = t.entries.find((e) => e.characterId === characterId && e.status !== "WITHDRAWN") ?? null;
  const currentMatch = mine && t.status === "RUNNING" ? (rounds[t.round - 1] ?? []).find((m) => m.a === mine.id || m.b === mine.id) : undefined;
  const opponent = currentMatch ? byId.get(currentMatch.a === mine!.id ? currentMatch.b : currentMatch.a) : undefined;
  const busy = !!(await getOpenDuelFor(c.id)) || !!(await getOpenJointFightFor(c.id));
  const check = canRegister({ onDressrosa, alive: c.status === "ALIVE", busy, status: t.status as TournamentStatus, alreadyRegistered: !!mine && mine.status !== "WITHDRAWN" });
  return {
    onDressrosa,
    lastChampion: lastFinished?.championName ?? null,
    tournament: {
      id: t.id,
      kind: t.kind,
      kindLabel: KIND_LABELS[t.kind as CompetitionKind],
      status: t.status,
      prize: parsePrize(t.prizeJson),
      startsAt: t.startsAt.toISOString(),
      roundEndsAt: t.roundEndsAt?.toISOString() ?? null,
      round: t.round,
      size: t.size,
      totalRounds: t.size ? totalRounds(t.size) : 0,
      roundLabel: t.size && t.round ? roundName(t.size, t.round) : null,
      championName: t.championName,
      registered: t.entries.filter((e) => e.status !== "WITHDRAWN" && !e.isNpc).map((e) => e.name),
      bracket: rounds.map((r, i) => ({
        label: roundName(t.size, i + 1),
        matches: r.map((m) => ({ a: byId.get(m.a)?.name ?? "?", b: byId.get(m.b)?.name ?? "?", winner: m.winner ? byId.get(m.winner)?.name ?? null : null, walkover: !!m.walkover, aHp: m.aHp ?? null, bHp: m.bHp ?? null })),
      })),
    },
    canRegister: check.ok,
    reason: check.ok ? null : check.reason,
    me: mine ? { status: mine.status, strategy: mine.strategy, opponent: opponent?.name ?? null, roundOut: mine.roundOut } : null,
  };
}
