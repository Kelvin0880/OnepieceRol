import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { resolveDuelRound } from "../engine/duel";
import { TECHNIQUE_LABELS, TechniqueId } from "../engine/techniques";
import { classifyPlayerAction } from "../ai/classify-action";
import { narrateDuel } from "../ai/narrate";
import { prepareFighter, combatProgressData } from "./combat-prep";
import { postNews } from "./death-resolution";
import { CharacterStatus } from "@prisma/client";

/**
 * 1-vs-1 duels between two real players. Both submit a move each round (free
 * text, classified exactly like a combat move); once both are in, the ENGINE
 * resolves the simultaneous exchange and the AI only narrates the result and
 * who won. Deliberately non-lethal: duel HP is a copy of maxHp and
 * Character.hp is never touched, so a duel can never cost a character their
 * life or leave scars — the loser is simply knocked out.
 */
export class DuelError extends Error {}

const STALE_DUEL_MS = 30 * 60 * 1000;
const RECENT_FINISHED_MS = 15 * 60 * 1000;

async function loadFighter(characterId: string) {
  return prisma.character.findUnique({ where: { id: characterId }, include: { devilFruit: true, equippedWeapon: true, currentIsland: true } });
}

/** The duel (if any) this character is currently tied up in: proposed or actively being fought. Lazily expires abandoned ones. */
export async function getOpenDuelFor(characterId: string) {
  const duel = await prisma.duel.findFirst({
    where: { status: { in: ["PROPOSED", "ACTIVE"] }, OR: [{ challengerId: characterId }, { opponentId: characterId }] },
    orderBy: { createdAt: "desc" },
  });
  if (!duel) return null;
  if (Date.now() - duel.updatedAt.getTime() > STALE_DUEL_MS) {
    await prisma.duel.update({ where: { id: duel.id }, data: { status: "CANCELLED" } });
    return null;
  }
  return duel;
}

export async function challengeDuel(challengerId: string, userId: string, opponentId: string) {
  if (challengerId === opponentId) throw new DuelError("No puedes retarte a ti mismo.");
  const [challenger, opponent] = await Promise.all([loadFighter(challengerId), loadFighter(opponentId)]);
  if (!challenger || challenger.userId !== userId) throw new DuelError("Personaje no encontrado.");
  if (!opponent) throw new DuelError("Ese rival no existe.");
  if (challenger.status !== CharacterStatus.ALIVE || opponent.status !== CharacterStatus.ALIVE) throw new DuelError("Ambos duelistas deben estar vivos y libres.");
  if (challenger.currentIslandId !== opponent.currentIslandId) throw new DuelError("Solo puedes retar a alguien que esté en tu misma isla.");
  if (opponent.userId === userId) throw new DuelError("Tus propios personajes no pueden batirse entre sí.");
  if (await getOpenDuelFor(challengerId)) throw new DuelError("Ya estás metido en un duelo.");
  if (await getOpenDuelFor(opponentId)) throw new DuelError(`${opponent.name} ya está metido en otro duelo.`);
  const pending = await prisma.pendingEncounter.findFirst({ where: { characterId: { in: [challengerId, opponentId] } } });
  if (pending) throw new DuelError("Alguno de los dos está en pleno enfrentamiento; primero hay que resolverlo.");

  const duel = await prisma.duel.create({
    data: {
      islandId: challenger.currentIslandId,
      challengerId,
      opponentId,
      challengerHp: challenger.maxHp,
      challengerMaxHp: challenger.maxHp,
      opponentHp: opponent.maxHp,
      opponentMaxHp: opponent.maxHp,
    },
  });
  await prisma.duelMessage.create({
    data: { duelId: duel.id, authorCharacterId: null, authorName: "Narrador", text: `${challenger.name} reta a ${opponent.name} a un duelo. Esperando su respuesta...` },
  });
  return { duelId: duel.id };
}

export async function respondToDuel(characterId: string, userId: string, duelId: string, accept: boolean) {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  const me = await prisma.character.findUnique({ where: { id: characterId } });
  if (!duel || !me || me.userId !== userId || duel.opponentId !== characterId) throw new DuelError("Ese duelo no es para ti.");
  if (duel.status !== "PROPOSED") throw new DuelError("Este duelo ya no está pendiente.");
  const challenger = await prisma.character.findUnique({ where: { id: duel.challengerId } });
  if (!accept) {
    await prisma.duel.update({ where: { id: duelId }, data: { status: "DECLINED" } });
    return { log: [`Rechazas el duelo de ${challenger?.name ?? "tu retador"}.`] };
  }
  await prisma.duel.update({ where: { id: duelId }, data: { status: "ACTIVE", round: 1 } });
  await prisma.duelMessage.create({
    data: {
      duelId,
      authorCharacterId: null,
      authorName: "Narrador",
      text: `${me.name} acepta. El duelo comienza: cada uno describe su movimiento y, cuando ambos lo hayan hecho, se resuelven a la vez.`,
    },
  });
  return { log: ["Aceptas el duelo. Describe tu primer movimiento."] };
}

export async function cancelDuel(characterId: string, userId: string, duelId: string) {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  const me = await prisma.character.findUnique({ where: { id: characterId } });
  if (!duel || !me || me.userId !== userId) throw new DuelError("Duelo no encontrado.");
  if (duel.challengerId !== characterId && duel.opponentId !== characterId) throw new DuelError("Ese duelo no es tuyo.");
  if (duel.status !== "PROPOSED") throw new DuelError("Un duelo en marcha solo termina peleando o rindiéndote (descríbelo en tu movimiento).");
  await prisma.duel.update({ where: { id: duelId }, data: { status: "CANCELLED" } });
  return { log: ["Duelo cancelado."] };
}

/**
 * A move in an ACTIVE duel. Returns as soon as it is recorded when the rival
 * hasn't answered yet; the second submission resolves the whole round.
 */
export async function submitDuelAction(characterId: string, userId: string, freeText: string) {
  const duel = await getOpenDuelFor(characterId);
  if (!duel || duel.status !== "ACTIVE") throw new DuelError("No estás en ningún duelo en marcha.");
  const meIsChallenger = duel.challengerId === characterId;
  const alreadySubmitted = meIsChallenger ? duel.challengerAction : duel.opponentAction;
  if (alreadySubmitted) throw new DuelError("Ya enviaste tu movimiento de esta ronda; espera al de tu rival.");

  const me = await loadFighter(characterId);
  if (!me || me.userId !== userId) throw new DuelError("Personaje no encontrado.");

  const lastNarration = await prisma.duelMessage.findFirst({ where: { duelId: duel.id, authorCharacterId: null }, orderBy: { createdAt: "desc" } });
  const classified = await classifyPlayerAction(freeText, ["engage", "flee"], { sceneContext: lastNarration?.text.slice(-500) });
  const yielded = classified.action === "flee";
  const technique: TechniqueId = classified.technique ?? "none";

  await prisma.duelMessage.create({ data: { duelId: duel.id, authorCharacterId: characterId, authorName: me.name, text: freeText } });

  const patch = meIsChallenger
    ? { challengerAction: yielded ? "__yield__" : freeText, challengerTactic: classified.tacticModifier, challengerTechnique: technique }
    : { opponentAction: yielded ? "__yield__" : freeText, opponentTactic: classified.tacticModifier, opponentTechnique: technique };
  const updated = await prisma.duel.update({ where: { id: duel.id }, data: patch });

  if (!updated.challengerAction || !updated.opponentAction) {
    return { log: ["Movimiento registrado. Esperando a tu rival..."], waiting: true };
  }
  return resolveDuelRoundFor(updated.id);
}

async function resolveDuelRoundFor(duelId: string) {
  const duel = await prisma.duel.findUniqueOrThrow({ where: { id: duelId } });
  // Both players can submit at nearly the same instant and each will see a
  // "complete" round — only whoever clears the actions first gets to resolve it.
  const claimed = await prisma.duel.updateMany({
    where: { id: duelId, round: duel.round, challengerAction: { not: null }, opponentAction: { not: null } },
    data: { challengerAction: null, opponentAction: null },
  });
  if (claimed.count === 0) return { log: ["Movimiento registrado. Esperando a tu rival..."], waiting: true };
  const [a, b] = await Promise.all([loadFighter(duel.challengerId), loadFighter(duel.opponentId)]);
  if (!a || !b) throw new DuelError("Uno de los duelistas ya no existe.");
  const rng = liveRng();

  const aYield = duel.challengerAction === "__yield__";
  const bYield = duel.opponentAction === "__yield__";

  let finished = false;
  let winner: "a" | "b" | null = null;
  let aHp = duel.challengerHp;
  let bHp = duel.opponentHp;
  let rounds: { attacker: string; defender: string; damage: number; outcome: "critical_fail" | "fail" | "success" | "critical_success" }[] = [];
  let aTech: TechniqueId = "none";
  let bTech: TechniqueId = "none";

  const aPrep = prepareFighter(a, duel.challengerTechnique as TechniqueId, duel.challengerTactic, aHp);
  const bPrep = prepareFighter(b, duel.opponentTechnique as TechniqueId, duel.opponentTactic, bHp);

  if (aYield || bYield) {
    finished = true;
    winner = aYield && bYield ? (a.agility >= b.agility ? "a" : "b") : aYield ? "b" : "a";
  } else {
    aTech = aPrep.effect.used;
    bTech = bPrep.effect.used;
    const r = resolveDuelRound(rng, duel.round, aPrep.combatant, aHp, bPrep.combatant, bHp);
    aHp = r.aHpAfter;
    bHp = r.bHpAfter;
    rounds = r.log;
    finished = r.finished;
    winner = r.winner;
  }

  const winnerChar = winner === "a" ? a : winner === "b" ? b : null;
  const loserChar = winner === "a" ? b : winner === "b" ? a : null;

  const narration = await narrateDuel(
    {
      round: duel.round,
      aName: a.name,
      bName: b.name,
      aAction: aYield ? "se rinde" : duel.challengerAction ?? "",
      bAction: bYield ? "se rinde" : duel.opponentAction ?? "",
      aTechnique: aTech !== "none" ? TECHNIQUE_LABELS[aTech] : undefined,
      bTechnique: bTech !== "none" ? TECHNIQUE_LABELS[bTech] : undefined,
      rounds,
      aHp,
      aMax: duel.challengerMaxHp,
      bHp,
      bMax: duel.opponentMaxHp,
      finished,
      winnerName: winnerChar?.name,
    },
    { duelId }
  );

  await prisma.duelMessage.create({ data: { duelId, authorCharacterId: null, authorName: "Narrador", text: narration } });
  await prisma.duel.update({
    where: { id: duelId },
    data: {
      challengerHp: aHp,
      opponentHp: bHp,
      round: finished ? duel.round : duel.round + 1,
      status: finished ? "FINISHED" : "ACTIVE",
      winnerId: winnerChar?.id ?? null,
      challengerTactic: 0,
      opponentTactic: 0,
      challengerTechnique: "none",
      opponentTechnique: "none",
    },
  });

  // Stamina and mastery are real costs/gains even in a friendly duel.
  if (!aYield) await prisma.character.update({ where: { id: a.id }, data: combatProgressData(a, aPrep, rng) });
  if (!bYield) await prisma.character.update({ where: { id: b.id }, data: combatProgressData(b, bPrep, rng) });

  if (finished && winnerChar && loserChar) {
    await postNews(
      `${winnerChar.name} vence a ${loserChar.name} en un duelo`,
      `Un duelo entre ${a.name} y ${b.name} en ${a.currentIsland.name} terminó con la victoria de ${winnerChar.name}.`,
      "Tripulaciones",
      winnerChar.id
    );
  }

  return { log: [narration], waiting: false, finished, winnerName: winnerChar?.name };
}

/** What the play page needs to render the duel panel for one character. */
export async function getDuelStateForCharacter(characterId: string) {
  const open = await getOpenDuelFor(characterId);
  const duel =
    open ??
    (await prisma.duel.findFirst({
      where: {
        status: "FINISHED",
        updatedAt: { gt: new Date(Date.now() - RECENT_FINISHED_MS) },
        OR: [{ challengerId: characterId }, { opponentId: characterId }],
      },
      orderBy: { updatedAt: "desc" },
    }));
  if (!duel) return null;

  const meIsChallenger = duel.challengerId === characterId;
  const opponentId = meIsChallenger ? duel.opponentId : duel.challengerId;
  const opponent = await prisma.character.findUnique({ where: { id: opponentId }, select: { name: true } });
  const messages = await prisma.duelMessage.findMany({ where: { duelId: duel.id }, orderBy: { createdAt: "asc" }, take: 40 });
  return {
    id: duel.id,
    status: duel.status,
    round: duel.round,
    isChallenger: meIsChallenger,
    opponentName: opponent?.name ?? "Rival",
    me: { hp: meIsChallenger ? duel.challengerHp : duel.opponentHp, maxHp: meIsChallenger ? duel.challengerMaxHp : duel.opponentMaxHp, submitted: !!(meIsChallenger ? duel.challengerAction : duel.opponentAction) },
    opponent: { hp: meIsChallenger ? duel.opponentHp : duel.challengerHp, maxHp: meIsChallenger ? duel.opponentMaxHp : duel.challengerMaxHp, submitted: !!(meIsChallenger ? duel.opponentAction : duel.challengerAction) },
    winnerId: duel.winnerId,
    messages: messages.map((m) => ({ id: m.id, authorName: m.authorName, isNarrator: m.authorCharacterId === null, mine: m.authorCharacterId === characterId, text: m.text })),
  };
}
