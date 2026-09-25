import { CharacterStatus } from "@prisma/client";
import { prisma } from "../db";
import { combatPower } from "../engine/encounter";
import { verdictOptions, captureReward, type VerdictChoice } from "../engine/duel-outcome";
import { narrateDuelReport } from "../ai/narrate";
import { toCombatant } from "./derive";
import { captureCharacter } from "./prison";
import { postNews } from "./death-resolution";
import { notifyPair } from "./notify";
import { settleGroupBattleIfDone } from "./battle-settle";

export class DuelError extends Error {}

export type DuelOutcome = "yield" | "knockout" | "kill" | "captured" | "spared" | "escaped";

async function loadPair(duelId: string) {
  const duel = await prisma.duel.findUnique({ where: { id: duelId } });
  if (!duel) throw new DuelError("Duelo no encontrado.");
  const include = { currentIsland: true, devilFruit: true, equippedWeapon: true } as const;
  const [a, b] = await Promise.all([prisma.character.findUnique({ where: { id: duel.challengerId }, include }), prisma.character.findUnique({ where: { id: duel.opponentId }, include })]);
  if (!a || !b) throw new DuelError("Uno de los duelistas ya no existe.");
  return { duel, a, b };
}

function seat(duel: { challengerId: string }, characterId: string) {
  return duel.challengerId === characterId ? "a" : "b";
}

const HEADLINES: Record<DuelOutcome, (w: string, l: string, lethal: boolean) => string> = {
  yield: (w, l) => `${l} se rinde ante ${w} en un duelo`,
  knockout: (w, l, lethal) => `${w} vence a ${l} en un duelo${lethal ? " a muerte" : ""}`,
  kill: (w, l) => `${w} da muerte a ${l} en un duelo a muerte`,
  captured: (w, l) => `${w} captura a ${l} tras un duelo a muerte`,
  spared: (w, l) => `${w} perdona la vida a ${l} tras un duelo a muerte`,
  escaped: (w, l) => `${l} logra escapar de ${w}`,
};

/** The end of every duel goes to the news, written from what really happened and always with the place. */
export async function postDuelReport(duelId: string, winnerName: string | null, loserName: string, outcome: DuelOutcome, place: { name: string; islandId: string }, lethal: boolean, actorId: string) {
  const lines = await prisma.duelMessage.findMany({ where: { duelId }, orderBy: { createdAt: "desc" }, take: 12 });
  const transcript = lines.reverse().map((m) => `${m.authorName}: ${m.text}`);
  const body = await narrateDuelReport({ winnerName, loserName, outcome, placeName: place.name, lethal, transcript }, { duelId });
  const w = winnerName ?? loserName;
  const headline = HEADLINES[outcome](w, loserName, lethal);
  const major = lethal && (outcome === "kill" || outcome === "captured");
  await postNews(headline, body, outcome === "kill" ? "Muertes" : lethal ? "Guerra" : "Tripulaciones", actorId, major ? "major" : "normal", { locationName: place.name, islandId: place.islandId });
}

async function closeDuel(duelId: string, winnerId: string | null, message: string) {
  const closed = await prisma.duel.update({ where: { id: duelId }, data: { status: "FINISHED", winnerId, resolution: null, pleaById: null, pleaText: null } });
  await prisma.duelMessage.create({ data: { duelId, authorCharacterId: null, authorName: "Árbitro", text: message } });
  await settleGroupBattleIfDone(closed.groupBattleId);
}

/** "Perdí": in a friendly duel that is the end; in a fight to the death the winner decides what happens next. */
export async function yieldDuel(characterId: string, userId: string, duelId: string) {
  const { duel, a, b } = await loadPair(duelId);
  const me = characterId === a.id ? a : characterId === b.id ? b : null;
  if (!me || me.userId !== userId) throw new DuelError("Ese duelo no es tuyo.");
  if (duel.status !== "ACTIVE") throw new DuelError("El duelo no está en marcha.");
  if (duel.resolution) throw new DuelError("Ya hay una decisión pendiente en este duelo.");
  const winner = me.id === a.id ? b : a;

  if (!duel.lethal) {
    await closeDuel(duelId, winner.id, `${me.name} se rinde. ¡${winner.name} gana el duelo! No pasa nada más: es un duelo amistoso.`);
    await postDuelReport(duelId, winner.name, me.name, "yield", { name: a.currentIsland.name, islandId: a.currentIslandId }, false, winner.id);
    await notifyPair(duel.challengerId, duel.opponentId);
    return { log: [`Te rindes. ${winner.name} gana el duelo amistoso.`], finished: true };
  }
  await prisma.duel.update({ where: { id: duelId }, data: { resolution: "VERDICT", pleaById: me.id, winnerId: winner.id } });
  await prisma.duelMessage.create({ data: { duelId, authorCharacterId: null, authorName: "Árbitro", text: `${me.name} se da por vencido. ${winner.name} decide su destino.` } });
  await notifyPair(duel.challengerId, duel.opponentId);
  return { log: [`Te das por vencido. ${winner.name} decidirá qué hace contigo.`], finished: false };
}

/** Trying to get away from a fight to the death: the player describes it and the other side decides, as agreed outside the game. */
export async function pleaToFlee(characterId: string, userId: string, duelId: string, text: string) {
  const { duel, a, b } = await loadPair(duelId);
  const me = characterId === a.id ? a : characterId === b.id ? b : null;
  if (!me || me.userId !== userId) throw new DuelError("Ese duelo no es tuyo.");
  const huntedBeforeFight = duel.status === "PROPOSED" && duel.hostile && me.id === duel.opponentId;
  if (!huntedBeforeFight && (duel.status !== "ACTIVE" || !duel.lethal)) throw new DuelError("Solo puedes intentar huir en un duelo a muerte en marcha, o de una caza que te han lanzado.");
  if (duel.resolution) throw new DuelError("Ya hay una decisión pendiente en este duelo.");
  const clean = text.trim();
  if (clean.length < 5) throw new DuelError("Describe cómo intentas escapar.");
  const other = me.id === a.id ? b : a;
  await prisma.duel.update({ where: { id: duelId }, data: { resolution: "FLEE_PLEA", pleaById: me.id, pleaText: clean.slice(0, 1200) } });
  await prisma.duelMessage.create({ data: { duelId, authorCharacterId: me.id, authorName: me.name, text: `Intenta huir: ${clean.slice(0, 1200)}` } });
  await notifyPair(duel.challengerId, duel.opponentId);
  return { log: [`Intentas huir. ${other.name} decide si te deja escapar.`] };
}

export async function decideFlee(characterId: string, userId: string, duelId: string, allow: boolean) {
  const { duel, a, b } = await loadPair(duelId);
  const me = characterId === a.id ? a : characterId === b.id ? b : null;
  if (!me || me.userId !== userId) throw new DuelError("Ese duelo no es tuyo.");
  if (duel.resolution !== "FLEE_PLEA" || !duel.pleaById) throw new DuelError("Nadie está intentando huir ahora.");
  if (duel.pleaById === me.id) throw new DuelError("Eso lo decide tu rival.");
  const fugitive = me.id === a.id ? b : a;

  if (duel.status === "PROPOSED") {
    // The hunt has not started: allowing the escape ends it, refusing it means the fight begins now.
    if (allow) {
      await closeDuel(duelId, null, `${me.name} deja que ${fugitive.name} escape de la caza.`);
      await postDuelReport(duelId, me.name, fugitive.name, "escaped", { name: a.currentIsland.name, islandId: a.currentIslandId }, true, fugitive.id);
      await notifyPair(duel.challengerId, duel.opponentId);
      return { log: [`Dejas escapar a ${fugitive.name}.`], finished: true };
    }
    await prisma.duel.update({ where: { id: duelId }, data: { status: "ACTIVE", round: 1, resolution: null, pleaById: null, pleaText: null } });
    await prisma.duelMessage.create({ data: { duelId, authorCharacterId: null, authorName: "Árbitro", text: `${me.name} corta el paso a ${fugitive.name}: no hay más remedio que pelear. Cada uno escribe su intención.` } });
    await notifyPair(duel.challengerId, duel.opponentId);
    return { log: [`Cierras el paso a ${fugitive.name}. Empieza el duelo.`], finished: false };
  }

  if (allow) {
    // Wounds are real in a fight to the death, whoever walks away.
    await prisma.character.update({ where: { id: a.id }, data: { hp: Math.max(1, duel.challengerHp) } });
    await prisma.character.update({ where: { id: b.id }, data: { hp: Math.max(1, duel.opponentHp) } });
    await closeDuel(duelId, null, `${me.name} deja que ${fugitive.name} escape. El duelo termina sin vencedor.`);
    await postDuelReport(duelId, me.name, fugitive.name, "escaped", { name: a.currentIsland.name, islandId: a.currentIslandId }, true, fugitive.id);
    await notifyPair(duel.challengerId, duel.opponentId);
    return { log: [`Dejas escapar a ${fugitive.name}.`], finished: true };
  }
  await prisma.duel.update({ where: { id: duelId }, data: { resolution: null, pleaById: null, pleaText: null } });
  await prisma.duelMessage.create({ data: { duelId, authorCharacterId: null, authorName: "Árbitro", text: `${me.name} no permite la huida de ${fugitive.name}: el duelo continúa.` } });
  await notifyPair(duel.challengerId, duel.opponentId);
  return { log: [`Impides la huida de ${fugitive.name}. El duelo continúa.`], finished: false };
}

/** The winner of a fight to the death chooses: kill, capture (Impel Down or handed over for the reward) or let them go. */
export async function decideVerdict(characterId: string, userId: string, duelId: string, choice: VerdictChoice) {
  const { duel, a, b } = await loadPair(duelId);
  const me = characterId === a.id ? a : characterId === b.id ? b : null;
  if (!me || me.userId !== userId) throw new DuelError("Ese duelo no es tuyo.");
  if (duel.resolution !== "VERDICT" || duel.winnerId !== me.id) throw new DuelError("No te toca decidir el destino de nadie.");
  const loser = me.id === a.id ? b : a;
  const place = { name: a.currentIsland.name, islandId: a.currentIslandId };
  const winnerHp = Math.max(1, seat(duel, me.id) === "a" ? duel.challengerHp : duel.opponentHp);
  const loserHp = Math.max(1, seat(duel, loser.id) === "a" ? duel.challengerHp : duel.opponentHp);
  const options = verdictOptions(me.faction, loser.faction);
  await prisma.character.update({ where: { id: me.id }, data: { hp: winnerHp } });
  const log: string[] = [];

  if (choice === "kill") {
    await prisma.character.update({ where: { id: loser.id }, data: { status: CharacterStatus.DEAD, hp: 0, deathCause: `Muerto por ${me.name} en un duelo a muerte en ${place.name}.`, diedAt: new Date() } });
    await closeDuel(duelId, me.id, `${me.name} da muerte a ${loser.name}.`);
    await postDuelReport(duelId, me.name, loser.name, "kill", place, true, me.id);
    log.push(`${loser.name} ha muerto por tu mano.`);
  } else if (choice === "capture") {
    if (!options.canCapture || !options.captureMode) throw new DuelError("No puedes capturar a alguien de la Marina o del CP-0.");
    const newsLog: string[] = [];
    await captureCharacter(
      { id: loser.id, name: loser.name, maxHp: loser.maxHp, currentIslandId: loser.currentIslandId, currentIsland: loser.currentIsland, level: loser.level, devilFruitId: loser.devilFruitId, faction: loser.faction, bounty: loser.bounty, notoriety: loser.notoriety },
      combatPower(toCombatant(me)),
      options.captureMode === "impel" ? `${me.name} lo capturó en un duelo a muerte en ${place.name}.` : `${me.name} lo entregó a la Marina tras un duelo a muerte en ${place.name}.`,
      newsLog
    );
    const reward = captureReward(loser.faction, loser.bounty, loser.notoriety);
    if (reward > 0) {
      await prisma.character.update({ where: { id: me.id }, data: { berries: { increment: reward } } });
      log.push(`Cobras ฿ ${reward.toLocaleString("es-ES")} por la captura de ${loser.name}.`);
    }
    await closeDuel(duelId, me.id, `${me.name} captura a ${loser.name}${options.captureMode === "sell" ? " y lo entrega a la Marina" : ""}.`);
    await postDuelReport(duelId, me.name, loser.name, "captured", place, true, me.id);
    log.push(`${loser.name} queda apresado.`);
  } else {
    await prisma.character.update({ where: { id: loser.id }, data: { hp: loserHp } });
    await closeDuel(duelId, me.id, `${me.name} perdona la vida a ${loser.name}.`);
    await postDuelReport(duelId, me.name, loser.name, "spared", place, true, me.id);
    log.push(`Perdonas la vida a ${loser.name}.`);
  }
  await notifyPair(duel.challengerId, duel.opponentId);
  return { log, finished: true };
}
