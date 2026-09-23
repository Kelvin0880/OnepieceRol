import { prisma } from "../db";
import {
  ConquestStage,
  STAGES,
  STAGE_LABELS,
  nextStage,
  contributionPoints,
  stageEnemy,
  stageRewards,
  garrisonAfterElapsed,
  consumedPeriodMs,
  fortifyCost,
  incomeAccrued,
  conquestExpired,
  resolveVote,
  allContributorsVoted,
  titleForHolder,
  VOTE_WINDOW_MS,
  DEFENSE_GARRISON_LOSS,
  GARRISON_MAX,
} from "../engine/territory";
import { isActorHome } from "../engine/guardian";
import { postNews } from "./death-resolution";
import { notifyIsland } from "./notify";
import { startJointFight, freePartyMemberIds, getOpenJointFightFor, JointFightError } from "./joint-fight";
import { CharacterStatus, Territory } from "@prisma/client";

export class TerritoryError extends Error {}

const MAX_MUSTER = 12;

const parse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

async function loadTerritory(islandId: string) {
  return prisma.territory.findUnique({ where: { islandId } });
}

/** The old power takes the island back: the player claimant loses it and their title. */
async function revertToPower(t: Territory, why: string): Promise<Territory> {
  const island = await prisma.island.findUnique({ where: { id: t.islandId } });
  const actor = t.homeActorId ? await prisma.worldActor.findUnique({ where: { id: t.homeActorId } }) : null;
  if (t.ownerCharacterId) await prisma.character.updateMany({ where: { id: t.ownerCharacterId, title: t.title }, data: { title: null } });
  const updated = await prisma.territory.update({
    where: { id: t.id },
    data: {
      ownerActorId: t.homeActorId,
      ownerCharacterId: null,
      ownerCrewId: null,
      ownerName: actor?.name ?? "Poderes locales",
      title: "Dominio del poder local",
      status: "HELD",
      stage: "ARMY",
      garrison: GARRISON_MAX,
      contributionsJson: "{}",
      votesJson: "{}",
      musterJson: "[]",
      finalBlowCharacterId: null,
      voteDeadline: null,
      lastPressureAt: new Date(),
    },
  });
  await postNews(`${actor?.name ?? "El antiguo poder"} recupera ${island?.name ?? "la isla"}`, why, "Guerra", undefined, "major");
  return updated;
}

async function finalizeClaim(t: Territory): Promise<Territory> {
  const island = await prisma.island.findUniqueOrThrow({ where: { id: t.islandId } });
  const contributions = parse<Record<string, number>>(t.contributionsJson, {});
  const votes = parse<Record<string, string>>(t.votesJson, {});
  const outcome = resolveVote(votes, contributions, t.finalBlowCharacterId);
  if (!outcome.winnerId) return revertToPower(t, `Nadie llegó a reclamar ${island.name} y el antiguo poder cerró filas de nuevo.`);

  const winner = await prisma.character.findUnique({ where: { id: outcome.winnerId }, include: { crew: true } });
  if (!winner || winner.status !== CharacterStatus.ALIVE) return revertToPower(t, `El reclamante de ${island.name} cayó antes de tomar posesión, y el antiguo poder aprovechó el vacío.`);
  const actor = t.homeActorId ? await prisma.worldActor.findUnique({ where: { id: t.homeActorId } }) : null;
  const title = titleForHolder(actor?.role ?? null, island.name);
  const ownerName = winner.crew?.name ? `${winner.crew.name} (${winner.name})` : winner.name;

  const updated = await prisma.territory.update({
    where: { id: t.id },
    data: {
      ownerActorId: null,
      ownerCharacterId: winner.id,
      ownerCrewId: winner.crewId,
      ownerName,
      title,
      status: "HELD",
      stage: "ARMY",
      garrison: GARRISON_MAX,
      lastPressureAt: new Date(),
      lastIncomeAt: new Date(),
      lastActivityAt: new Date(),
      contributionsJson: "{}",
      votesJson: "{}",
      musterJson: "[]",
      finalBlowCharacterId: null,
      voteDeadline: null,
    },
  });
  await prisma.character.update({ where: { id: winner.id }, data: { title } });
  // Taking a Government stronghold is the one thing the Government answers with the fleet.
  if (island.name === "Enies Lobby") {
    const { startBusterCall } = await import("./buster-call");
    await startBusterCall(island.id, `${winner.name} se ha hecho con Enies Lobby, la sede judicial del Gobierno Mundial.`);
  }

  const contested = Object.keys(contributions).length > 1;
  const names = await prisma.character.findMany({ where: { id: { in: Object.keys(contributions) } }, select: { id: true, name: true } });
  const nameOf = (id: string) => names.find((n) => n.id === id)?.name ?? "alguien";
  await postNews(
    `${winner.name} se proclama ${title}`,
    contested
      ? `Tras la caída de ${actor?.name ?? "su antiguo señor"}, los vencedores se disputaron ${island.name}. Por votación ponderada de lo aportado por cada uno (${Object.entries(outcome.tally).map(([id, w]) => `${nameOf(id)}: ${w}`).join(", ") || "sin votos"}), la isla queda en manos de ${ownerName}.`
      : `${winner.name} ha derrotado a ${actor?.name ?? "su antiguo señor"} y toma ${island.name} como suya.`,
    "Guerra",
    winner.id,
    "major"
  );
  return updated;
}

/** Lazily applies everything that happens with the passage of time: idle conquests lapse, vote windows close, neglected garrisons fall. */
export async function refreshTerritory(t: Territory, now = new Date()): Promise<Territory> {
  let cur = t;
  if (cur.status === "CONQUEST" && conquestExpired(cur.lastActivityAt.getTime(), now.getTime())) {
    cur = await prisma.territory.update({ where: { id: cur.id }, data: { status: "HELD", stage: "ARMY", contributionsJson: "{}", musterJson: "[]" } });
  }
  if (cur.status === "CLAIM_VOTE") {
    const contributions = parse<Record<string, number>>(cur.contributionsJson, {});
    const votes = parse<Record<string, string>>(cur.votesJson, {});
    const due = (cur.voteDeadline && cur.voteDeadline.getTime() <= now.getTime()) || allContributorsVoted(votes, contributions);
    if (due) cur = await finalizeClaim(cur);
  }
  if (cur.status === "HELD" && cur.ownerCharacterId) {
    const elapsed = now.getTime() - cur.lastPressureAt.getTime();
    const consumed = consumedPeriodMs(elapsed);
    if (consumed > 0) {
      const garrison = garrisonAfterElapsed(cur.garrison, elapsed);
      cur = await prisma.territory.update({ where: { id: cur.id }, data: { garrison, lastPressureAt: new Date(cur.lastPressureAt.getTime() + consumed) } });
      if (garrison <= 0) {
        const island = await prisma.island.findUnique({ where: { id: cur.islandId } });
        cur = await revertToPower(cur, `Sin una guarnición que la sostuviera, ${island?.name ?? "la isla"} cayó de nuevo bajo su antiguo poder: ${cur.ownerName} no supo defenderla.`);
      }
    }
  }
  return cur;
}

/** A bombarded island loses its player garrison outright: the fleet takes it back for the Government's side. */
export async function loseTerritoryToFleet(islandId: string): Promise<void> {
  const t = await loadTerritory(islandId);
  if (!t || !t.ownerCharacterId) return;
  const island = await prisma.island.findUnique({ where: { id: islandId } });
  await revertToPower(t, `La flota de la Buster Call arrasó las defensas de ${t.ownerName} en ${island?.name ?? "la isla"} y devolvió el control a su antiguo poder.`);
}

async function loadActor(t: Territory) {
  const id = t.ownerActorId ?? t.homeActorId;
  return id ? prisma.worldActor.findUnique({ where: { id } }) : null;
}

export async function getTerritoryState(characterId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me) return null;
  const raw = await loadTerritory(me.currentIslandId);
  if (!raw) return null;
  const t = await refreshTerritory(raw);
  const contributions = parse<Record<string, number>>(t.contributionsJson, {});
  const votes = parse<Record<string, string>>(t.votesJson, {});
  const muster = parse<string[]>(t.musterJson, []);
  const ids = [...new Set([...Object.keys(contributions), ...muster, ...(t.ownerCharacterId ? [t.ownerCharacterId] : [])])];
  const people = await prisma.character.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  const actor = await loadActor(t);
  const holderHome = actor ? isActorHome(actor.busyUntil, new Date()) : false;
  const isOwner = t.ownerCharacterId === me.id;
  const heldByPlayers = !!t.ownerCharacterId;

  return {
    id: t.id,
    islandName: me.currentIsland.name,
    status: t.status,
    stage: t.status === "CONQUEST" ? t.stage : null,
    stageLabel: t.status === "CONQUEST" ? STAGE_LABELS[t.stage as ConquestStage] : null,
    stages: STAGES.map((s) => ({ id: s, label: STAGE_LABELS[s] })),
    ownerName: t.ownerName,
    title: t.title,
    heldByPlayers,
    isOwner,
    garrison: heldByPlayers ? t.garrison : null,
    holderName: actor?.name ?? null,
    holderHome,
    muster: muster.map((id) => ({ id, name: nameOf(id) })),
    iAmMustered: muster.includes(me.id),
    contributions: Object.entries(contributions).map(([id, points]) => ({ id, name: nameOf(id), points })),
    votes: Object.entries(votes).map(([voterId, candidateId]) => ({ voter: nameOf(voterId), candidate: nameOf(candidateId) })),
    myVote: votes[me.id] ?? null,
    iContributed: (contributions[me.id] ?? 0) > 0,
    voteDeadline: t.voteDeadline,
    fortifyCost: heldByPlayers && isOwner ? fortifyCost(t.garrison) : null,
    pendingIncome: heldByPlayers && isOwner ? incomeAccrued(me.currentIsland.dangerLevel, Date.now() - t.lastIncomeAt.getTime()) : null,
    canAssault: !heldByPlayers && t.status !== "CLAIM_VOTE",
  };
}

async function requireOnIsland(characterId: string, userId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true, crew: true } });
  if (!me || me.userId !== userId) throw new TerritoryError("Personaje no encontrado.");
  if (me.status !== CharacterStatus.ALIVE) throw new TerritoryError("No puedes hacer esto en tu estado actual.");
  const raw = await loadTerritory(me.currentIslandId);
  if (!raw) throw new TerritoryError("Esta isla no tiene un dominio que conquistar.");
  return { me, t: await refreshTerritory(raw) };
}

export async function musterForConquest(characterId: string, userId: string, join: boolean) {
  const { me, t } = await requireOnIsland(characterId, userId);
  if (t.ownerCharacterId) throw new TerritoryError("Esta isla ya tiene dueño.");
  if (t.status === "CLAIM_VOTE") throw new TerritoryError("Ya se ha vencido a la resistencia: ahora toca votar.");
  const muster = parse<string[]>(t.musterJson, []);
  const next = join ? [...new Set([...muster, me.id])].slice(-MAX_MUSTER) : muster.filter((id) => id !== me.id);
  await prisma.territory.update({ where: { id: t.id }, data: { musterJson: JSON.stringify(next) } });
  await notifyIsland(me.currentIslandId, "territory");
  return { log: [join ? "Te apuntas a la hueste que va a asaltar la isla." : "Te retiras de la hueste."] };
}

export async function assaultTerritory(characterId: string, userId: string) {
  const { me, t } = await requireOnIsland(characterId, userId);
  if (t.ownerCharacterId) throw new TerritoryError("Esta isla ya tiene dueño: solo puede perderse si abandona su guarnición.");
  if (t.status === "CLAIM_VOTE") throw new TerritoryError("Ya se ha vencido a la resistencia: ahora toca votar quién se queda la isla.");
  if (await getOpenJointFightFor(me.id)) throw new TerritoryError("Ya estás metido en una pelea.");

  const stage: ConquestStage = t.status === "CONQUEST" ? (t.stage as ConquestStage) : "ARMY";
  const actor = await loadActor(t);
  if (!actor) throw new TerritoryError("Esta isla no tiene poder que la defienda.");
  if (stage === "HOLDER" && !isActorHome(actor.busyUntil, new Date())) {
    throw new TerritoryError(`${actor.name} no está en la isla ahora mismo: el asalto final tiene que esperar a que regrese.`);
  }

  const muster = parse<string[]>(t.musterJson, []);
  const candidateIds = [...new Set([me.id, ...muster, ...(await freePartyMemberIds(me.id))])];
  const here = await prisma.character.findMany({ where: { id: { in: candidateIds }, currentIslandId: me.currentIslandId, status: CharacterStatus.ALIVE } });
  const ready: string[] = [];
  for (const c of here) if (c.id === me.id || !(await getOpenJointFightFor(c.id))) ready.push(c.id);

  const stats = stageEnemy(stage, actor.powerLevel, me.currentIsland.dangerLevel);
  const name = stage === "ARMY" ? `Ejército de ${actor.name}` : stage === "COMMANDERS" ? `Comandantes de ${actor.name}` : actor.name;
  let started;
  try {
    started = await startJointFight({
      kind: "conquest",
      characterIds: ready,
      enemy: { name, ...stats, isBoss: true, personality: actor.personality ?? undefined, ...(stage === "HOLDER" ? { worldActorId: actor.id, isActor: true } : {}) },
      rewards: stageRewards(stage, me.currentIsland.dangerLevel),
      stakes: `Asalto a ${me.currentIsland.name}: hay que romper ${STAGE_LABELS[stage]} de ${actor.name}.`,
      context: { territoryId: t.id, stage, op: "assault" },
    });
  } catch (err) {
    if (err instanceof JointFightError) throw new TerritoryError(err.message);
    throw err;
  }
  await prisma.territory.update({ where: { id: t.id }, data: { status: "CONQUEST", stage, lastActivityAt: new Date(), musterJson: "[]" } });
  await notifyIsland(me.currentIslandId, "territory");
  return { log: [`Comienza el asalto: hay que romper ${STAGE_LABELS[stage]}. Todos los participantes describen su movimiento.`], fightId: started.fightId };
}

export async function castVote(characterId: string, userId: string, candidateId: string) {
  const { me, t } = await requireOnIsland(characterId, userId);
  if (t.status !== "CLAIM_VOTE") throw new TerritoryError("No hay ninguna votación abierta.");
  const contributions = parse<Record<string, number>>(t.contributionsJson, {});
  if (!(contributions[me.id] > 0)) throw new TerritoryError("Solo votan quienes participaron en la conquista.");
  if (!(contributions[candidateId] > 0)) throw new TerritoryError("Ese candidato no participó en la conquista.");
  const votes = parse<Record<string, string>>(t.votesJson, {});
  votes[me.id] = candidateId;
  const saved = await prisma.territory.update({ where: { id: t.id }, data: { votesJson: JSON.stringify(votes) } });
  const after = await refreshTerritory(saved);
  await notifyIsland(me.currentIslandId, "territory");
  return { log: [after.status === "CLAIM_VOTE" ? "Voto registrado. La votación sigue abierta hasta que voten todos o pasen 24 horas." : `La votación ha terminado: ${after.ownerName} es ahora ${after.title}.`] };
}

export async function fortifyTerritory(characterId: string, userId: string) {
  const { me, t } = await requireOnIsland(characterId, userId);
  if (t.ownerCharacterId !== me.id) throw new TerritoryError("Solo el dueño puede reforzar la guarnición.");
  const cost = fortifyCost(t.garrison);
  if (cost === 0) throw new TerritoryError("La guarnición ya está al máximo.");
  if (me.berries < cost) throw new TerritoryError(`Reforzar la guarnición cuesta ฿ ${cost.toLocaleString("es-ES")} y no los tienes.`);
  await prisma.character.update({ where: { id: me.id }, data: { berries: me.berries - cost } });
  await prisma.territory.update({ where: { id: t.id }, data: { garrison: GARRISON_MAX, lastPressureAt: new Date() } });
  await notifyIsland(me.currentIslandId, "territory");
  return { log: [`Pagas ฿ ${cost.toLocaleString("es-ES")} y la guarnición vuelve a estar al máximo.`] };
}

export async function collectIncome(characterId: string, userId: string) {
  const { me, t } = await requireOnIsland(characterId, userId);
  if (t.ownerCharacterId !== me.id) throw new TerritoryError("Solo el dueño cobra los tributos de la isla.");
  const amount = incomeAccrued(me.currentIsland.dangerLevel, Date.now() - t.lastIncomeAt.getTime());
  if (amount <= 0) throw new TerritoryError("Todavía no se ha acumulado nada que cobrar.");
  await prisma.character.update({ where: { id: me.id }, data: { berries: me.berries + amount } });
  await prisma.territory.update({ where: { id: t.id }, data: { lastIncomeAt: new Date() } });
  await notifyIsland(me.currentIslandId, "territory");
  return { log: [`Cobras ฿ ${amount.toLocaleString("es-ES")} en tributos de ${me.currentIsland.name}.`] };
}

/** The old power sends a force to retake the island: the owner (and anyone with them) must hold the line in a real fight. */
export async function defendTerritory(characterId: string, userId: string) {
  const { me, t } = await requireOnIsland(characterId, userId);
  if (t.ownerCrewId ? me.crewId !== t.ownerCrewId && t.ownerCharacterId !== me.id : t.ownerCharacterId !== me.id) throw new TerritoryError("Solo el dueño y su tripulación defienden la isla.");
  if (!t.ownerCharacterId) throw new TerritoryError("Nadie amenaza esta isla: aún no tiene dueño.");
  if (t.garrison >= GARRISON_MAX) throw new TerritoryError("La guarnición está intacta: no hay fuerza de retoma que repeler ahora.");
  const actor = t.homeActorId ? await prisma.worldActor.findUnique({ where: { id: t.homeActorId } }) : null;
  const allies = await freePartyMemberIds(me.id);
  const stats = stageEnemy("COMMANDERS", actor?.powerLevel ?? 70, me.currentIsland.dangerLevel);
  try {
    const started = await startJointFight({
      kind: "conquest",
      characterIds: allies,
      enemy: { name: `Fuerza de retoma de ${actor?.name ?? "los antiguos señores"}`, ...stats, isBoss: true },
      rewards: stageRewards("ARMY", me.currentIsland.dangerLevel),
      stakes: `Defensa de ${me.currentIsland.name}: si la guarnición cae, la isla se pierde.`,
      context: { territoryId: t.id, op: "defense" },
    });
    await notifyIsland(me.currentIslandId, "territory");
    return { log: ["Se acerca una fuerza de retoma. Todos describen su movimiento."], fightId: started.fightId };
  } catch (err) {
    if (err instanceof JointFightError) throw new TerritoryError(err.message);
    throw err;
  }
}

export interface SettledConquestFight {
  contextJson: string;
  outcome: "victory" | "defeat" | null;
  humans: { characterId: string; status: string; name: string }[];
}

/** Called by joint-fight.ts when a "conquest" fight ends: advances the conquest, or repels it, or resolves a defense. */
export async function handleConquestSettled(fight: SettledConquestFight): Promise<string[]> {
  const ctx = parse<{ territoryId?: string; stage?: ConquestStage; op?: string }>(fight.contextJson, {});
  const raw = ctx.territoryId ? await prisma.territory.findUnique({ where: { id: ctx.territoryId } }) : null;
  if (!raw) return [];
  const island = await prisma.island.findUniqueOrThrow({ where: { id: raw.islandId } });
  const lines: string[] = [];

  if (ctx.op === "defense") {
    if (fight.outcome === "victory") {
      await prisma.territory.update({ where: { id: raw.id }, data: { garrison: GARRISON_MAX, lastPressureAt: new Date() } });
      lines.push("La fuerza de retoma es rechazada: la guarnición vuelve a estar al máximo.");
    } else if (fight.outcome === "defeat") {
      const garrison = Math.max(0, raw.garrison - DEFENSE_GARRISON_LOSS);
      const saved = await prisma.territory.update({ where: { id: raw.id }, data: { garrison } });
      if (garrison <= 0) {
        await revertToPower(saved, `Tras una defensa fallida, ${island.name} vuelve a manos de su antiguo poder: ${raw.ownerName} no pudo sostenerla.`);
        lines.push("La defensa fracasa y la isla se pierde.");
      } else lines.push(`La defensa fracasa: la guarnición cae a ${garrison}.`);
    }
    await notifyIsland(raw.islandId, "territory");
    return lines;
  }

  const stage = (ctx.stage ?? "ARMY") as ConquestStage;
  if (fight.outcome === "victory") {
    const contributions = parse<Record<string, number>>(raw.contributionsJson, {});
    for (const h of fight.humans.filter((x) => x.status !== "FLED")) {
      contributions[h.characterId] = (contributions[h.characterId] ?? 0) + contributionPoints(stage, h.status === "DOWN");
    }
    const next = nextStage(stage);
    const finalBlow = parse<{ finalBlowCharacterId?: string }>(fight.contextJson, {}).finalBlowCharacterId ?? null;
    if (next) {
      await prisma.territory.update({ where: { id: raw.id }, data: { status: "CONQUEST", stage: next, contributionsJson: JSON.stringify(contributions), lastActivityAt: new Date() } });
      lines.push(`Se rompe ${STAGE_LABELS[stage]}. Siguiente frente: ${STAGE_LABELS[next]}.`);
      await postNews(`${island.name} se tambalea`, `Un asalto ha roto ${STAGE_LABELS[stage]} de ${raw.ownerName} en ${island.name}. La resistencia empieza a resquebrajarse.`, "Guerra", undefined, "normal");
    } else {
      await prisma.territory.update({
        where: { id: raw.id },
        data: {
          status: "CLAIM_VOTE",
          contributionsJson: JSON.stringify(contributions),
          finalBlowCharacterId: finalBlow,
          voteDeadline: new Date(Date.now() + VOTE_WINDOW_MS),
          votesJson: "{}",
          lastActivityAt: new Date(),
        },
      });
      lines.push(`¡${raw.ownerName} ha caído! ${island.name} queda sin dueño. Quienes participaron votan quién se queda la isla (24 h, o antes si votan todos).`);
    }
  } else if (fight.outcome === "defeat") {
    await prisma.territory.update({ where: { id: raw.id }, data: { status: "HELD", stage: "ARMY", contributionsJson: "{}", musterJson: "[]" } });
    lines.push("El asalto es rechazado: los defensores cierran filas y todo el progreso de la conquista se pierde.");
  }
  await notifyIsland(raw.islandId, "territory");
  return lines;
}
