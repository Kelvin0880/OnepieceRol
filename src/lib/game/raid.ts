import { prisma } from "../db";
import { CharacterStatus, Raid } from "@prisma/client";
import {
  RAID_PHASES,
  MAX_RAID_PARTICIPANTS,
  RAID_VOTE_WINDOW_MS,
  phaseEnemy,
  phaseRewards,
  joinBlockReason,
  raidCooldownLeftMs,
  raidExpired,
  canPledge,
  allyStats,
  PHASE_NAMES,
} from "../engine/raid";
import { resolveVote, allContributorsVoted } from "../engine/territory";
import { postNews } from "./death-resolution";
import { notifyCharacters } from "../realtime";
import { notifyIsland } from "./notify";
import { startJointFight, getOpenJointFightFor, JointFightError, AllyNpc } from "./joint-fight";
import { standingsFor } from "./alliance";
import { KING_TITLE, HERO_TITLE, NEW_ERA, newEraNewsBody } from "./endgame-lore";

export class RaidError extends Error {}

const RAID_ISLAND_NAME = "Mary Geoise";
const MIN_LAUNCH_HUMANS = 2;
const OPEN_STATUSES = ["MUSTERING", "ACTIVE", "CLAIM_VOTE"];

const parse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

const raidIsland = () => prisma.island.findFirst({ where: { name: RAID_ISLAND_NAME } });
const openRaid = () => prisma.raid.findFirst({ where: { status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "desc" } });

async function notifyMuster(raid: Raid) {
  notifyCharacters(parse<string[]>(raid.musterJson, []), "raid");
  const isle = await raidIsland();
  if (isle) await notifyIsland(isle.id, "raid");
}

/** Applies what the clock decides: an abandoned muster lapses and an overdue vote resolves. */
export async function refreshRaid(raid: Raid, now = new Date()): Promise<Raid> {
  if (raid.status === "MUSTERING" && raidExpired(raid.lastActivityAt.getTime(), now.getTime())) {
    await prisma.raid.updateMany({ where: { id: raid.id, status: "MUSTERING" }, data: { status: "CANCELLED", resolvedAt: now } });
    return prisma.raid.findUniqueOrThrow({ where: { id: raid.id } });
  }
  if (raid.status === "CLAIM_VOTE") {
    const contributions = parse<Record<string, number>>(raid.contributionsJson, {});
    const votes = parse<Record<string, string>>(raid.votesJson, {});
    const overdue = raid.voteDeadline && raid.voteDeadline.getTime() <= now.getTime();
    if (overdue || allContributorsVoted(votes, contributions)) return finalizeCrown(raid);
  }
  return raid;
}

async function finalizeCrown(raid: Raid): Promise<Raid> {
  const claimed = await prisma.raid.updateMany({ where: { id: raid.id, status: "CLAIM_VOTE" }, data: { status: "WON", resolvedAt: new Date() } });
  if (claimed.count === 0) return prisma.raid.findUniqueOrThrow({ where: { id: raid.id } });
  const contributions = parse<Record<string, number>>(raid.contributionsJson, {});
  const votes = parse<Record<string, string>>(raid.votesJson, {});
  const { winnerId } = resolveVote(votes, contributions, raid.finalBlowCharacterId);
  const participants = Object.keys(contributions).filter((id) => contributions[id] > 0);
  for (const id of participants) {
    if (id !== winnerId) await prisma.character.updateMany({ where: { id, title: null }, data: { title: HERO_TITLE } });
  }
  let kingName = "Un desconocido";
  if (winnerId) {
    const king = await prisma.character.update({ where: { id: winnerId }, data: { title: KING_TITLE } });
    kingName = king.name;
  }
  await prisma.worldClock.upsert({ where: { id: 1 }, create: { id: 1, era: NEW_ERA }, update: { era: NEW_ERA } });
  await prisma.raid.update({ where: { id: raid.id }, data: { finalBlowCharacterId: winnerId ?? raid.finalBlowCharacterId } });
  await postNews("Empieza la Nueva Era", newEraNewsBody(kingName), "Gobierno Mundial", winnerId ?? undefined, "major", { locationName: "Mary Geoise" });
  notifyCharacters(participants, "raid");
  return prisma.raid.findUniqueOrThrow({ where: { id: raid.id } });
}

async function requireParticipant(characterId: string, userId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me || me.userId !== userId) throw new RaidError("Personaje no encontrado.");
  if (me.status !== CharacterStatus.ALIVE) throw new RaidError("No puedes hacer esto en tu estado actual.");
  return me;
}

async function cooldownLeft() {
  const last = await prisma.raid.findFirst({ where: { status: { in: ["WON", "LOST"] } }, orderBy: { resolvedAt: "desc" } });
  return raidCooldownLeftMs(last?.resolvedAt ?? null, last?.status ?? null, new Date());
}

export async function getRaidState(characterId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId } });
  if (!me) return null;
  const isle = await raidIsland();
  if (!isle) return null;
  if (!me.knowsTruth && me.currentIslandId !== isle.id) return null;
  const raw = await openRaid();
  const raid = raw ? await refreshRaid(raw) : null;
  const live = raid && OPEN_STATUSES.includes(raid.status) ? raid : null;
  const muster = live ? parse<string[]>(live.musterJson, []) : [];
  const mates = muster.length ? await prisma.character.findMany({ where: { id: { in: muster } }, select: { id: true, name: true } }) : [];
  const allies = live ? parse<string[]>(live.alliesJson, []) : [];
  const allyActors = allies.length ? await prisma.worldActor.findMany({ where: { id: { in: allies } }, select: { id: true, name: true } }) : [];
  const standings = me.knowsTruth ? await standingsFor(me.id) : [];
  const contributions = live ? parse<Record<string, number>>(live.contributionsJson, {}) : {};
  const votes = live ? parse<Record<string, string>>(live.votesJson, {}) : {};
  const candidates = live?.status === "CLAIM_VOTE" ? await prisma.character.findMany({ where: { id: { in: Object.keys(contributions).filter((k) => contributions[k] > 0) } }, select: { id: true, name: true } }) : [];
  return {
    knowsTruth: me.knowsTruth,
    onRaidIsland: me.currentIslandId === isle.id,
    islandName: isle.name,
    cooldownMs: await cooldownLeft(),
    status: live?.status ?? null,
    phase: live?.phase ?? 1,
    phases: RAID_PHASES,
    phaseName: PHASE_NAMES[(live?.phase ?? 1) - 1],
    iAmLeader: live?.leaderId === me.id,
    iAmMustered: muster.includes(me.id),
    muster: mates,
    maxParticipants: MAX_RAID_PARTICIPANTS,
    allies: allyActors,
    standings: standings.map((s) => ({ ...s, pledged: allies.includes(s.actorId) })),
    voting: live?.status === "CLAIM_VOTE" ? { candidates, deadline: live.voteDeadline, iVoted: !!votes[me.id], iCanVote: (contributions[me.id] ?? 0) > 0 } : null,
  };
}

export async function musterRaid(characterId: string, userId: string, join: boolean) {
  const me = await requireParticipant(characterId, userId);
  const isle = await raidIsland();
  if (!isle) throw new RaidError("Mary Geoise no existe en este mundo.");
  const raw = await openRaid();
  let raid = raw ? await refreshRaid(raw) : null;
  if (raid && !OPEN_STATUSES.includes(raid.status)) raid = null;
  if (!join) {
    if (!raid || raid.status !== "MUSTERING") throw new RaidError("No hay ninguna coalición que abandonar ahora.");
    const next = parse<string[]>(raid.musterJson, []).filter((id) => id !== me.id);
    await prisma.raid.update({
      where: { id: raid.id },
      data: next.length ? { musterJson: JSON.stringify(next), leaderId: raid.leaderId === me.id ? next[0] : raid.leaderId, lastActivityAt: new Date() } : { musterJson: "[]", status: "CANCELLED", resolvedAt: new Date() },
    });
    await notifyMuster(raid);
    return { log: ["Abandonas la coalición."] };
  }
  if (raid && raid.status !== "MUSTERING") throw new RaidError("El asalto ya está en marcha.");
  const wait = await cooldownLeft();
  if (wait > 0) throw new RaidError(`La guardia de Mary Geoise aún se está reorganizando. Podréis intentarlo en ${Math.ceil(wait / 60_000)} min.`);
  const muster = raid ? parse<string[]>(raid.musterJson, []) : [];
  const block = joinBlockReason({ knowsTruth: me.knowsTruth, onIsland: me.currentIslandId === isle.id, alreadyMustered: muster.includes(me.id), musterSize: muster.length });
  if (block) throw new RaidError(block);
  if (!raid) {
    raid = await prisma.raid.create({ data: { leaderId: me.id, musterJson: JSON.stringify([me.id]) } });
    await postNews("Se reúne una coalición", "Corre la voz por el Mar: alguien está reuniendo a quienes conocen la verdad de Laugh Tale para marchar sobre Mary Geoise.", "Gobierno Mundial", me.id, "normal");
  } else {
    raid = await prisma.raid.update({ where: { id: raid.id }, data: { musterJson: JSON.stringify([...muster, me.id]), lastActivityAt: new Date() } });
  }
  await notifyMuster(raid);
  return { log: ["Te sumas a la coalición que asaltará Mary Geoise."] };
}

export async function pledgeAlly(characterId: string, userId: string, actorId: string) {
  const me = await requireParticipant(characterId, userId);
  const raw = await openRaid();
  const raid = raw ? await refreshRaid(raw) : null;
  if (!raid || raid.status !== "MUSTERING") throw new RaidError("No hay ninguna coalición reuniéndose.");
  if (raid.leaderId !== me.id) throw new RaidError("Solo el líder de la coalición puede llamar a los aliados.");
  const allies = parse<string[]>(raid.alliesJson, []);
  if (allies.includes(actorId)) throw new RaidError("Ese aliado ya está con la coalición.");
  const row = await prisma.alliance.findUnique({ where: { worldActorId_characterId: { worldActorId: actorId, characterId: me.id } } });
  const verdict = canPledge(row?.standing ?? 0, allies.length);
  if (!verdict.ok) throw new RaidError(verdict.reason ?? "No puede unirse.");
  const actor = await prisma.worldActor.findUnique({ where: { id: actorId } });
  if (!actor) throw new RaidError("Ese personaje no existe.");
  await prisma.raid.update({ where: { id: raid.id }, data: { alliesJson: JSON.stringify([...allies, actorId]), lastActivityAt: new Date() } });
  await notifyMuster(raid);
  return { log: [`${actor.name} acepta luchar a vuestro lado.`] };
}

/** Sends the coalition against the current phase as one big joint fight, allies included. */
export async function launchRaidPhase(characterId: string, userId: string) {
  const me = await requireParticipant(characterId, userId);
  const raw = await openRaid();
  const raid = raw ? await refreshRaid(raw) : null;
  if (!raid || raid.status !== "MUSTERING") throw new RaidError("No hay ninguna coalición lista para atacar.");
  if (raid.leaderId !== me.id) throw new RaidError("Solo el líder de la coalición da la orden de asalto.");
  const muster = parse<string[]>(raid.musterJson, []);
  const here = await prisma.character.findMany({ where: { id: { in: muster }, currentIslandId: me.currentIslandId, status: CharacterStatus.ALIVE } });
  const ready: string[] = [];
  for (const c of here) if (!(await getOpenJointFightFor(c.id))) ready.push(c.id);
  if (ready.length < MIN_LAUNCH_HUMANS) throw new RaidError(`Hacen falta al menos ${MIN_LAUNCH_HUMANS} miembros en pie y en Mary Geoise para dar el asalto.`);

  const pledged = parse<string[]>(raid.alliesJson, []);
  const actors = pledged.length ? await prisma.worldActor.findMany({ where: { id: { in: pledged } } }) : [];
  const extraNpcs: AllyNpc[] = actors.map((a) => ({ actorId: a.id, name: a.name, stats: allyStats(a.powerLevel) }));
  const enemy = phaseEnemy(raid.phase);
  try {
    const started = await startJointFight({
      kind: "raid",
      characterIds: ready,
      extraNpcs,
      enemy: { name: enemy.name, hp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd, isBoss: true },
      rewards: phaseRewards(raid.phase),
      stakes: `Asalto a Mary Geoise, fase ${raid.phase} de ${RAID_PHASES}: ${enemy.name}.`,
      context: { raidId: raid.id, phase: raid.phase, maxEnemyAttacks: enemy.maxEnemyAttacks },
    });
    await prisma.raid.update({ where: { id: raid.id }, data: { status: "ACTIVE", lastActivityAt: new Date() } });
    await notifyMuster(raid);
    return { log: [`Comienza la fase ${raid.phase}: ${enemy.name}. Cada uno describe su movimiento.`], fightId: started.fightId };
  } catch (err) {
    if (err instanceof JointFightError) throw new RaidError(err.message);
    throw err;
  }
}

export interface SettledRaidFight {
  contextJson: string;
  outcome: "victory" | "defeat" | null;
  humans: { characterId: string; status: string; name: string }[];
}

/** Called by joint-fight.ts when a raid fight carrying a raidId ends. */
export async function handleRaidPhaseSettled(fight: SettledRaidFight): Promise<string[]> {
  const ctx = parse<{ raidId?: string; phase?: number; finalBlowCharacterId?: string }>(fight.contextJson, {});
  if (!ctx.raidId) return [];
  const raid = await prisma.raid.findUnique({ where: { id: ctx.raidId } });
  if (!raid || raid.status !== "ACTIVE") return [];
  const phase = ctx.phase ?? raid.phase;
  const contributions = parse<Record<string, number>>(raid.contributionsJson, {});

  if (fight.outcome === "victory") {
    for (const h of fight.humans.filter((x) => x.status !== "FLED")) contributions[h.characterId] = (contributions[h.characterId] ?? 0) + 10 * phase + (h.status === "DOWN" ? 0 : 5);
    if (phase >= RAID_PHASES) {
      await prisma.raid.update({
        where: { id: raid.id },
        data: { status: "CLAIM_VOTE", contributionsJson: JSON.stringify(contributions), finalBlowCharacterId: ctx.finalBlowCharacterId ?? null, votesJson: "{}", voteDeadline: new Date(Date.now() + RAID_VOTE_WINDOW_MS), lastActivityAt: new Date() },
      });
      await postNews("El Rey Sin Nombre ha caído", "El Trono Vacío de Mary Geoise está vacío por primera vez en ochocientos años. La coalición se reúne para decidir quién lleva la corona del Rey de los Piratas.", "Gobierno Mundial", undefined, "major");
      await notifyMuster(raid);
      return ["¡El Rey Sin Nombre ha caído! Quienes participasteis votáis ahora quién será el Rey de los Piratas (24 h, o antes si votan todos)."];
    }
    await prisma.raid.update({ where: { id: raid.id }, data: { phase: phase + 1, status: "MUSTERING", contributionsJson: JSON.stringify(contributions), lastActivityAt: new Date() } });
    await postNews(`Cae ${PHASE_NAMES[phase - 1]}`, `La coalición ha roto una capa más de la defensa de Mary Geoise. Solo queda ${PHASE_NAMES[phase]}.`, "Guerra", undefined, "major");
    await notifyMuster(raid);
    return [`Fase ${phase} superada. Toca reagruparse y dar la orden de la siguiente: ${PHASE_NAMES[phase]}.`];
  }
  if (fight.outcome === "defeat") {
    await prisma.raid.update({ where: { id: raid.id }, data: { status: "LOST", resolvedAt: new Date() } });
    await postNews("El asalto a Mary Geoise fracasa", "La coalición ha sido aplastada a las puertas del Trono Vacío. Los supervivientes huyen y la guardia se rearma.", "Guerra", undefined, "major");
    await notifyMuster(raid);
    return ["La coalición cae. El asalto fracasa y la guardia de Mary Geoise se reorganiza."];
  }
  return [];
}

export async function castRaidVote(characterId: string, userId: string, candidateId: string) {
  const me = await requireParticipant(characterId, userId);
  const raw = await openRaid();
  if (!raw || raw.status !== "CLAIM_VOTE") throw new RaidError("No hay ninguna votación abierta.");
  const contributions = parse<Record<string, number>>(raw.contributionsJson, {});
  if (!(contributions[me.id] > 0)) throw new RaidError("Solo votan quienes participaron en el asalto.");
  if (!(contributions[candidateId] > 0)) throw new RaidError("Ese candidato no participó en el asalto.");
  const votes = parse<Record<string, string>>(raw.votesJson, {});
  votes[me.id] = candidateId;
  const saved = await prisma.raid.update({ where: { id: raw.id }, data: { votesJson: JSON.stringify(votes) } });
  const after = await refreshRaid(saved);
  await notifyMuster(after);
  return { log: [after.status === "CLAIM_VOTE" ? "Voto registrado. La votación sigue abierta hasta que voten todos o pasen 24 horas." : "La votación ha terminado: el Rey de los Piratas ha sido coronado."] };
}
