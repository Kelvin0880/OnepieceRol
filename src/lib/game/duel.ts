import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { applyVerdict, NO_VERDICT_TEXT } from "../engine/referee";
import { FATIGUE_LABELS } from "../engine/stamina";
import { attemptFlee } from "../engine/encounter";
import { areHostile, huntBlockReason, HUNT_RESPONSE_WINDOW_MS, HUNT_REPEAT_COOLDOWN_MS, PlayerFaction } from "../engine/hostility";
import { TECHNIQUE_LABELS, TechniqueId } from "../engine/techniques";
import { classifyPlayerAction } from "../ai/classify-action";
import { narrateDuel, refereeExchange } from "../ai/narrate";
import { prepareFighter, combatProgressData, characterCapabilityText } from "./combat-prep";
import { toCombatant } from "./derive";
import { postNews } from "./death-resolution";
import { notifyPair } from "./notify";
import { resolveDuelLoss, grantVictorSpoils } from "./group-battle";
import { CharacterStatus } from "@prisma/client";

/**
 * 1-vs-1 duels between two real players. Both submit a move each round (free
 * text, classified exactly like a combat move); once both are in, the ENGINE
 * resolves the simultaneous exchange and the AI only narrates the result and
 * who won.
 *
 * Two kinds:
 *  - friendly (default): consensual and non-lethal — duel HP is a copy of
 *    maxHp and Character.hp is never touched.
 *  - lethal: real permadeath rules. Between hostile factions (see
 *    engine/hostility.ts) it is a HUNT that needs no consent — a Marine going
 *    after a pirate, a pirate after a Marine — though the target may try to
 *    slip away instead of standing to fight, and only online, non-novice
 *    players can be hunted. Between non-hostile players it needs both sides to
 *    agree. The loser goes through the same death roll / Marine-capture path
 *    as every other lost fight (resolveDuelLoss), so nothing about permadeath
 *    is special-cased here.
 */
export class DuelError extends Error {}

const STALE_DUEL_MS = 30 * 60 * 1000;
const RECENT_FINISHED_MS = 15 * 60 * 1000;
const FLEE_FAILED_TACTIC = -10;

async function loadFighter(characterId: string) {
  return prisma.character.findUnique({ where: { id: characterId }, include: { devilFruit: true, equippedWeapon: true, currentIsland: true, companions: true, styles: true, ownedWeapons: { where: { wielded: true } } } });
}

/** The duel (if any) this character is currently tied up in: proposed or actively being fought. Lazily expires abandoned ones. */
export async function getOpenDuelFor(characterId: string) {
  const duel = await prisma.duel.findFirst({
    where: { status: { in: ["PROPOSED", "ACTIVE"] }, OR: [{ challengerId: characterId }, { opponentId: characterId }] },
    orderBy: { createdAt: "desc" },
  });
  if (!duel) return null;
  const idle = Date.now() - duel.updatedAt.getTime();
  // A hunted player who never answers has simply slipped away.
  const expired = duel.status === "PROPOSED" && duel.hostile ? idle > HUNT_RESPONSE_WINDOW_MS : idle > STALE_DUEL_MS;
  if (expired) {
    await prisma.duel.update({ where: { id: duel.id }, data: { status: "CANCELLED" } });
    return null;
  }
  return duel;
}

export async function challengeDuel(challengerId: string, userId: string, opponentId: string, lethal = false) {
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

  const hostile = lethal && areHostile(challenger.faction as PlayerFaction, opponent.faction as PlayerFaction);
  if (hostile) {
    const lastHunt = await prisma.duel.findFirst({
      where: { challengerId, opponentId, lethal: true, hostile: true, status: { in: ["FINISHED", "CANCELLED"] }, updatedAt: { gt: new Date(Date.now() - HUNT_REPEAT_COOLDOWN_MS) } },
      orderBy: { updatedAt: "desc" },
    });
    const block = huntBlockReason({ targetLevel: opponent.level, targetLastSeenAt: opponent.lastSeenAt, lastHuntEndedAt: lastHunt?.updatedAt ?? null });
    if (block) throw new DuelError(block);
  }

  // Lethal fights start from real HP (wounds are real); friendly ones from full health.
  const aHp = lethal ? Math.max(1, challenger.hp) : challenger.maxHp;
  const bHp = lethal ? Math.max(1, opponent.hp) : opponent.maxHp;
  const duel = await prisma.duel.create({
    data: {
      islandId: challenger.currentIslandId,
      challengerId,
      opponentId,
      lethal,
      hostile,
      challengerHp: aHp,
      challengerMaxHp: challenger.maxHp,
      opponentHp: bHp,
      opponentMaxHp: opponent.maxHp,
    },
  });
  const text = hostile
    ? `${challenger.name} (${challenger.faction}) da caza a ${opponent.name} en ${challenger.currentIsland.name}. ${opponent.name} puede plantar cara o intentar huir.`
    : lethal
    ? `${challenger.name} propone a ${opponent.name} un duelo A MUERTE. Solo se celebra si ${opponent.name} acepta.`
    : `${challenger.name} reta a ${opponent.name} a un duelo. Esperando su respuesta...`;
  await prisma.duelMessage.create({ data: { duelId: duel.id, authorCharacterId: null, authorName: "Narrador", text } });
  await notifyPair(challengerId, opponentId);
  return { duelId: duel.id };
}

export async function respondToDuel(characterId: string, userId: string, duelId: string, accept: boolean) {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  const me = await loadFighter(characterId);
  if (!duel || !me || me.userId !== userId || duel.opponentId !== characterId) throw new DuelError("Ese duelo no es para ti.");
  if (duel.status !== "PROPOSED") throw new DuelError("Este duelo ya no está pendiente.");
  const challenger = await loadFighter(duel.challengerId);
  if (!challenger) throw new DuelError("Tu retador ya no existe.");

  if (accept) {
    await prisma.duel.update({ where: { id: duelId }, data: { status: "ACTIVE", round: 1 } });
    await prisma.duelMessage.create({
      data: {
        duelId,
        authorCharacterId: null,
        authorName: "Narrador",
        text: `${me.name} ${duel.hostile ? "planta cara" : "acepta"}. ${duel.lethal ? "Es a muerte." : ""} Cada uno describe su movimiento y, cuando ambos lo hayan hecho, se resuelven a la vez.`,
      },
    });
    return { log: ["Aceptas el duelo. Describe tu primer movimiento."] };
  }

  if (!duel.hostile) {
    await prisma.duel.update({ where: { id: duelId }, data: { status: "DECLINED" } });
    return { log: [`Rechazas el duelo de ${challenger.name}.`] };
  }

  // Being hunted: not answering "yes" means trying to get away, decided by the
  // same speed contest as fleeing any fight — no free pass, no free kill.
  const flee = attemptFlee(liveRng(), toCombatant(me), toCombatant(challenger));
  if (flee.success) {
    await prisma.duel.update({ where: { id: duelId }, data: { status: "CANCELLED" } });
    await prisma.duelMessage.create({ data: { duelId, authorCharacterId: null, authorName: "Narrador", text: `${me.name} logra escabullirse de la caza de ${challenger.name}.` } });
    await postNews(`${me.name} escapa de ${challenger.name}`, `${challenger.name} le dio caza en ${me.currentIsland.name}, pero ${me.name} consiguió desaparecer entre la multitud.`, "Tripulaciones", me.id);
    return { log: [`Logras escabullirte de ${challenger.name}. Esta vez.`] };
  }
  await prisma.duel.update({ where: { id: duelId }, data: { status: "ACTIVE", round: 1 } });
  await prisma.duelMessage.create({
    data: { duelId, authorCharacterId: null, authorName: "Narrador", text: `${me.name} intenta huir, pero ${challenger.name} le corta el paso. No queda más remedio que pelear.` },
  });
  return { log: [`No logras huir: ${challenger.name} te alcanza. Toca pelear.`] };
}

export async function cancelDuel(characterId: string, userId: string, duelId: string) {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  const me = await prisma.character.findUnique({ where: { id: characterId } });
  if (!duel || !me || me.userId !== userId) throw new DuelError("Duelo no encontrado.");
  if (duel.challengerId !== characterId && duel.opponentId !== characterId) throw new DuelError("Ese duelo no es tuyo.");
  if (duel.status !== "PROPOSED") throw new DuelError("Un duelo en marcha solo termina peleando, rindiéndote o huyendo (descríbelo en tu movimiento).");
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
  await notifyPair(duel.challengerId, duel.opponentId);

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

  let aYield = duel.challengerAction === "__yield__";
  let bYield = duel.opponentAction === "__yield__";
  let aTactic = duel.challengerTactic;
  let bTactic = duel.opponentTactic;

  let finished = false;
  let winner: "a" | "b" | null = null;
  let escaped: "a" | "b" | null = null;
  const failedFlight: string[] = [];
  let aHp = duel.challengerHp;
  let bHp = duel.opponentHp;
  let rounds: { attacker: string; defender: string; damage: number; outcome: "critical_fail" | "fail" | "success" | "critical_success" }[] = [];
  let aStaminaLoss = 0;
  let bStaminaLoss = 0;
  let aiNarration: string | null = null;
  let aTech: TechniqueId = "none";
  let bTech: TechniqueId = "none";

  // In a fight to the death "yielding" isn't surrender — it is trying to get
  // away, decided by a speed contest. A failed attempt just wastes the round.
  if (duel.lethal) {
    const aBase = toCombatant(a);
    const bBase = toCombatant(b);
    if (aYield) {
      if (attemptFlee(rng, aBase, bBase).success) escaped = "a";
      else {
        failedFlight.push(a.name);
        aYield = false;
        aTactic = FLEE_FAILED_TACTIC;
      }
    }
    if (bYield && !escaped) {
      if (attemptFlee(rng, bBase, aBase).success) escaped = "b";
      else {
        failedFlight.push(b.name);
        bYield = false;
        bTactic = FLEE_FAILED_TACTIC;
      }
    }
  }

  const aPrep = prepareFighter(a, duel.challengerTechnique as TechniqueId, aTactic, aHp, undefined, duel.challengerAction ?? "");
  const bPrep = prepareFighter(b, duel.opponentTechnique as TechniqueId, bTactic, bHp, undefined, duel.opponentAction ?? "");

  if (escaped) {
    finished = true;
  } else if (aYield || bYield) {
    finished = true;
    winner = aYield && bYield ? (a.agility >= b.agility ? "a" : "b") : aYield ? "b" : "a";
  } else {
    aTech = aPrep.effect.used;
    bTech = bPrep.effect.used;
    const verdict = await refereeExchange(
      {
        mode: "duel",
        round: duel.round,
        lethal: duel.lethal,
        actors: [
          { name: a.name, side: "player", level: a.level, hp: aHp, maxHp: duel.challengerMaxHp, stamina: aPrep.staminaAfter, fatigue: aPrep.fatigue !== "fresh" ? FATIGUE_LABELS[aPrep.fatigue] : undefined, kit: characterCapabilityText(a), sheet: `ataque ${aPrep.combatant.atk}, defensa ${aPrep.combatant.def}, velocidad ${aPrep.combatant.spd}` },
          { name: b.name, side: "player", level: b.level, hp: bHp, maxHp: duel.opponentMaxHp, stamina: bPrep.staminaAfter, fatigue: bPrep.fatigue !== "fresh" ? FATIGUE_LABELS[bPrep.fatigue] : undefined, kit: characterCapabilityText(b), sheet: `ataque ${bPrep.combatant.atk}, defensa ${bPrep.combatant.def}, velocidad ${bPrep.combatant.spd}` },
        ],
        actions: [
          { name: a.name, text: aTactic === FLEE_FAILED_TACTIC ? "intenta huir del duelo pero no lo consigue" : duel.challengerAction ?? "", technique: aTech !== "none" ? TECHNIQUE_LABELS[aTech] : undefined },
          { name: b.name, text: bTactic === FLEE_FAILED_TACTIC ? "intenta huir del duelo pero no lo consigue" : duel.opponentAction ?? "", technique: bTech !== "none" ? TECHNIQUE_LABELS[bTech] : undefined },
        ],
      },
      { context: "duel" }
    );
    if (!verdict) {
      // Nothing was judged: give both moves back so the round can be resubmitted untouched.
      await prisma.duel.update({ where: { id: duelId }, data: { challengerAction: duel.challengerAction, opponentAction: duel.opponentAction } });
      return { log: [NO_VERDICT_TEXT], waiting: true };
    }
    const [ra, rb] = applyVerdict(verdict, [
      { name: a.name, hp: aHp, maxHp: duel.challengerMaxHp, stamina: aPrep.staminaAfter },
      { name: b.name, hp: bHp, maxHp: duel.opponentMaxHp, stamina: bPrep.staminaAfter },
    ]);
    aHp = ra.hpAfter;
    bHp = rb.hpAfter;
    aStaminaLoss = ra.staminaLoss;
    bStaminaLoss = rb.staminaLoss;
    aiNarration = verdict.narration;
    finished = aHp <= 0 || bHp <= 0;
    if (finished) winner = aHp > 0 ? "a" : bHp > 0 ? "b" : ra.hpLoss / duel.challengerMaxHp <= rb.hpLoss / duel.opponentMaxHp ? "a" : "b";
  }

  const winnerChar = winner === "a" ? a : winner === "b" ? b : null;
  const loserChar = winner === "a" ? b : winner === "b" ? a : null;
  const escapedChar = escaped === "a" ? a : escaped === "b" ? b : null;

  const narration = aiNarration ?? await narrateDuel(
    {
      round: duel.round,
      aName: a.name,
      bName: b.name,
      aAction: escaped === "a" ? "huye del duelo" : aYield ? "se rinde" : duel.challengerAction === "__yield__" ? "intenta huir" : duel.challengerAction ?? "",
      bAction: escaped === "b" ? "huye del duelo" : bYield ? "se rinde" : duel.opponentAction === "__yield__" ? "intenta huir" : duel.opponentAction ?? "",
      aTechnique: aTech !== "none" ? TECHNIQUE_LABELS[aTech] : undefined,
      bTechnique: bTech !== "none" ? TECHNIQUE_LABELS[bTech] : undefined,
      rounds,
      aHp,
      aMax: duel.challengerMaxHp,
      bHp,
      bMax: duel.opponentMaxHp,
      finished,
      winnerName: winnerChar?.name,
      escapedName: escapedChar?.name,
      lethal: duel.lethal,
      failedFlight,
      aKit: characterCapabilityText(a),
      bKit: characterCapabilityText(b),
    },
    { duelId }
  );

  await prisma.duelMessage.create({ data: { duelId, authorCharacterId: null, authorName: "Narrador", text: narration } });
  await notifyPair(duel.challengerId, duel.opponentId);
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
  if (!aYield) await prisma.character.update({ where: { id: a.id }, data: combatProgressData(a, aPrep, rng, 0, aStaminaLoss) });
  if (!bYield) await prisma.character.update({ where: { id: b.id }, data: combatProgressData(b, bPrep, rng, 0, bStaminaLoss) });

  const log = [narration];

  if (duel.lethal) {
    // Wounds are real in a fight to the death, whoever walks away.
    if (!finished || escapedChar) {
      await prisma.character.update({ where: { id: a.id }, data: { hp: Math.max(1, aHp) } });
      await prisma.character.update({ where: { id: b.id }, data: { hp: Math.max(1, bHp) } });
    }
    if (finished && winnerChar && loserChar) {
      const newsLog: string[] = [];
      const winnerPrep = winnerChar.id === a.id ? aPrep : bPrep;
      const winnerHp = winnerChar.id === a.id ? aHp : bHp;
      await prisma.character.update({ where: { id: winnerChar.id }, data: { hp: Math.max(1, winnerHp) } });
      const outcome = await resolveDuelLoss(
        loserChar,
        { faction: winnerChar.faction, combatant: winnerPrep.combatant },
        `Cayó en un duelo a muerte contra ${winnerChar.name} en ${loserChar.currentIsland.name}.`,
        newsLog
      );
      if (!outcome.died && !outcome.captured) await prisma.character.update({ where: { id: loserChar.id }, data: { hp: outcome.finalHp } });
      const fresh = await prisma.character.findUniqueOrThrow({ where: { id: winnerChar.id } });
      await grantVictorSpoils(fresh, winnerChar.currentIsland.dangerLevel, newsLog);
      // Bringing in a wanted pirate is what the Government and hunters get paid for.
      if ((outcome.died || outcome.captured) && loserChar.faction === "PIRATE" && ["MARINE", "CP0", "BOUNTY_HUNTER"].includes(winnerChar.faction)) {
        const reward = Math.min(500_000, Math.round(loserChar.bounty * 0.1));
        if (reward > 0) {
          await prisma.character.update({ where: { id: winnerChar.id }, data: { berries: { increment: reward } } });
          log.push(`Cobras ฿ ${reward.toLocaleString("es-ES")} por la captura de ${loserChar.name}.`);
        }
      }
      const fate = outcome.died ? "cae muerto" : outcome.captured ? "es capturado" : "queda malherido, pero con vida";
      await postNews(
        `${winnerChar.name} vence a ${loserChar.name} en un duelo a muerte`,
        `${loserChar.name} ${fate} tras un combate sin cuartel en ${loserChar.currentIsland.name}.`,
        "Guerra",
        winnerChar.id,
        "major"
      );
      log.push(outcome.died ? `${loserChar.name} ha muerto.` : outcome.captured ? `${loserChar.name} es apresado.` : `${loserChar.name} sobrevive, malherido.`);
    }
  } else if (finished && winnerChar && loserChar) {
    await postNews(
      `${winnerChar.name} vence a ${loserChar.name} en un duelo`,
      `Un duelo entre ${a.name} y ${b.name} en ${a.currentIsland.name} terminó con la victoria de ${winnerChar.name}.`,
      "Tripulaciones",
      winnerChar.id
    );
  }

  return { log, waiting: false, finished, winnerName: winnerChar?.name };
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
    lethal: duel.lethal,
    hostile: duel.hostile,
    isChallenger: meIsChallenger,
    opponentName: opponent?.name ?? "Rival",
    me: { hp: meIsChallenger ? duel.challengerHp : duel.opponentHp, maxHp: meIsChallenger ? duel.challengerMaxHp : duel.opponentMaxHp, submitted: !!(meIsChallenger ? duel.challengerAction : duel.opponentAction) },
    opponent: { hp: meIsChallenger ? duel.opponentHp : duel.challengerHp, maxHp: meIsChallenger ? duel.opponentMaxHp : duel.challengerMaxHp, submitted: !!(meIsChallenger ? duel.opponentAction : duel.challengerAction) },
    winnerId: duel.winnerId,
    messages: messages.map((m) => ({ id: m.id, authorName: m.authorName, isNarrator: m.authorCharacterId === null, mine: m.authorCharacterId === characterId, text: m.text })),
  };
}
