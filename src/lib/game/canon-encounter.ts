// Canon characters on your island: ask them for a task, or go against them (a real subordinate first, then them in person).
// Nobody here is invented: vanguards are the character's own people (canon) or real island residents.
import { prisma } from "../db";
import type { Mission, WorldActor } from "@prisma/client";
import { postNews } from "./death-resolution";
import { actorCombatStats } from "../engine/guardian";
import { missionRewards, missionTier } from "../engine/missions";
import {
  CANON_CHALLENGE_WINDOW_MS,
  canonMinLevel,
  canonRewardMultiplier,
  challengeBlockReason,
  duelEnemyOf,
  isVerdictChoice,
  missionBlockReason,
  pickVanguard,
  verdictReward,
  type CanonActorView,
  type VerdictChoice,
} from "../engine/canon-encounter";
import { isFighter, npcStats } from "../engine/island-npc";
import type { PlayerFaction } from "../engine/hostility";
import { narrateCanonBrief } from "../ai/canon";
import { engagedNpcIds, loadRoster } from "./island-npcs";
import { freePartyMemberIds, JointFightError, startJointFight, getOpenJointFightFor } from "./joint-fight";
import { recordMercyIncident } from "./grudges";
import { addStanding } from "./alliance";
import { applyBountyOrNotoriety } from "./reputation";
import { invalidateWorldState } from "./world-state";
import { npcState } from "../engine/island-npc";

export class CanonError extends Error {}

const OPEN_STAGES = ["VANGUARD", "READY", "DUEL", "WON", "AWAITING_OWNER"];
const WON_EXPIRY_MS = 72 * 3600_000;

const toView = (a: WorldActor): CanonActorView => ({ id: a.id, name: a.name, role: a.role, powerLevel: a.powerLevel, factionType: a.factionType, status: a.status, locationHidden: a.locationHidden, currentIslandId: a.currentIslandId });
const asFaction = (f: string): PlayerFaction => (f === "CP0" ? "CP0" : (f as PlayerFaction));

async function loadOwned(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.userId !== userId) throw new CanonError("Personaje no encontrado.");
  if (c.status !== "ALIVE") throw new CanonError("Tu personaje no puede actuar ahora.");
  return c;
}

async function actorBusy(a: WorldActor, exceptChallengeId?: string): Promise<boolean> {
  if (a.busyUntil && a.busyUntil.getTime() > Date.now()) return true;
  const other = await prisma.canonChallenge.findFirst({ where: { actorId: a.id, stage: { in: OPEN_STAGES }, ...(exceptChallengeId ? { id: { not: exceptChallengeId } } : {}) }, select: { id: true } });
  return !!other;
}

const rankOf = (a: WorldActor) => a.rankLabel ?? a.role.toLowerCase().replace(/_/g, " ");

/** What the play screen shows: the canon characters in plain sight on your island, what you can do with each, and your open challenge. */
export async function getCanonHere(characterId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, select: { id: true, level: true, faction: true, currentIslandId: true, status: true } });
  if (!me || me.status !== "ALIVE") return null;
  const actors = await prisma.worldActor.findMany({ where: { status: "ACTIVE", currentIslandId: me.currentIslandId, locationHidden: false }, orderBy: [{ powerLevel: "desc" }, { name: "asc" }] });
  const challenge = await prisma.canonChallenge.findFirst({ where: { characterId, stage: { in: OPEN_STAGES } }, orderBy: { createdAt: "desc" } });
  const missions = actors.length ? await prisma.mission.findMany({ where: { characterId, patronActorId: { in: actors.map((a) => a.id) } }, orderBy: { createdAt: "desc" } }) : [];
  const now = new Date();
  const list = [];
  for (const a of actors) {
    const mine = missions.filter((m) => m.patronActorId === a.id);
    const busy = await actorBusy(a, challenge?.id);
    const withBlock = missionBlockReason({ actor: toView(a), playerFaction: asFaction(me.faction), playerIslandId: me.currentIslandId, level: me.level, hasOpenMission: mine.some((m) => m.status === "ACTIVE"), lastMissionAt: mine[0]?.createdAt ?? null, now });
    const againstBlock = challenge && challenge.actorId !== a.id ? "Ya tienes un desafío abierto con otro personaje." : challengeBlockReason({ actor: toView(a), playerFaction: asFaction(me.faction), playerIslandId: me.currentIslandId, level: me.level, hasOpenChallenge: !!challenge && challenge.actorId === a.id, busy });
    list.push({
      id: a.id,
      name: a.name,
      rank: rankOf(a),
      factionName: a.factionName,
      power: a.powerLevel,
      personality: a.personality,
      isYonko: a.role === "YONKO",
      minLevel: canonMinLevel(a.powerLevel),
      withBlock,
      againstBlock: challenge?.actorId === a.id ? null : againstBlock,
      openMission: mine.find((m) => m.status === "ACTIVE")?.title ?? null,
    });
  }
  return {
    actors: list,
    challenge: challenge
      ? { id: challenge.id, actorId: challenge.actorId, actorName: challenge.actorName, stage: challenge.stage, msLeft: challenge.stage === "READY" ? Math.max(0, CANON_CHALLENGE_WINDOW_MS - (now.getTime() - challenge.updatedAt.getTime())) : null, note: challenge.note }
      : null,
  };
}

async function pickMissionTarget(islandId: string, actorFaction: string, level: number, characterId: string) {
  const roster = await loadRoster(islandId);
  const engaged = await engagedNpcIds(characterId);
  const now = new Date();
  const wanted = actorFaction === "PIRATE" || actorFaction === "REVOLUTIONARY" ? ["guard", "marine"] : ["thug", "pirate"];
  const pool = roster.filter((n) => npcState(n, now, engaged).usable && wanted.includes(n.category) && n.level <= level + 8).sort((a, b) => b.level - a.level);
  return pool[0] ?? null;
}

/** "Pedirle un encargo": a mission with this canon character as the patron. */
export async function requestCanonMission(characterId: string, userId: string, actorId: string): Promise<{ log: string[] }> {
  const me = await loadOwned(characterId, userId);
  const actor = await prisma.worldActor.findUnique({ where: { id: actorId } });
  if (!actor) throw new CanonError("Ese personaje no existe.");
  const mine = await prisma.mission.findMany({ where: { characterId, patronActorId: actor.id }, orderBy: { createdAt: "desc" }, take: 5 });
  const reason = missionBlockReason({ actor: toView(actor), playerFaction: asFaction(me.faction), playerIslandId: me.currentIslandId, level: me.level, hasOpenMission: mine.some((m) => m.status === "ACTIVE"), lastMissionAt: mine[0]?.createdAt ?? null, now: new Date() });
  if (reason) throw new CanonError(reason);
  const island = me.currentIsland;
  const tier = missionTier(me.level, island.minLevelToEnter);
  const target = await pickMissionTarget(island.id, actor.factionType, me.level, me.id);
  const kind = target ? "defeat_npc" : "explore";
  const base = missionRewards(tier, island.dangerLevel, target ? "win_fights" : "explore");
  const mult = canonRewardMultiplier(actor.powerLevel);
  const brief = await narrateCanonBrief({ actorName: actor.name, rank: actor.rankLabel, personality: actor.personality, factionName: actor.factionName, islandName: island.name, characterName: me.name, targetName: target?.name ?? null, targetTitle: target?.title ?? null }, { characterId: me.id });
  const mission: Mission = await prisma.mission.create({
    data: {
      characterId: me.id,
      islandId: island.id,
      kind,
      title: target ? `Encargo de ${actor.name}: acabar con ${target.name}` : `Encargo de ${actor.name}: recorre ${island.name}`,
      brief,
      target: target ? 1 : 3,
      tier,
      berries: Math.round(base.berries * mult),
      xp: Math.round(base.xp * mult),
      patronActorId: actor.id,
      targetNpcId: target?.id ?? null,
      isArc: false,
    },
  });
  return { log: [`${actor.name} te da un encargo: «${mission.title}». Lo tienes en tus misiones de la isla.`, brief] };
}

/** "Desafiarlo": opens the challenge. First whoever guards them (a real subordinate or resident), then the character in person. */
export async function startCanonChallenge(characterId: string, userId: string, actorId: string): Promise<{ log: string[] }> {
  const me = await loadOwned(characterId, userId);
  const actor = await prisma.worldActor.findUnique({ where: { id: actorId } });
  if (!actor) throw new CanonError("Ese personaje no existe.");
  if (await prisma.canonChallenge.findFirst({ where: { characterId, stage: { in: OPEN_STAGES } } })) throw new CanonError("Ya tienes un desafío abierto.");
  if (await getOpenJointFightFor(me.id)) throw new CanonError("Ya estás metido en una pelea.");
  const busy = await actorBusy(actor);
  const reason = challengeBlockReason({ actor: toView(actor), playerFaction: asFaction(me.faction), playerIslandId: me.currentIslandId, level: me.level, hasOpenChallenge: false, busy });
  if (reason) throw new CanonError(reason);

  const crew = actor.factionName.replace(/\s*\(.*\)\s*$/, "").trim();
  const pool = await prisma.worldActor.findMany({ where: { status: "ACTIVE", factionName: { startsWith: crew } } });
  const candidates = await Promise.all(pool.map(async (c) => ({ id: c.id, name: c.name, powerLevel: c.powerLevel, factionName: c.factionName, status: c.status, currentIslandId: c.currentIslandId, role: c.role, busy: await actorBusy(c) })));
  const sub = pickVanguard({ id: actor.id, factionName: actor.factionName, powerLevel: actor.powerLevel, currentIslandId: actor.currentIslandId }, candidates);
  const subActor = sub ? pool.find((p) => p.id === sub.id)! : null;

  let enemy: Parameters<typeof startJointFight>[0]["enemy"] | null = null;
  let vanguardName = "";
  if (subActor) {
    const s = actorCombatStats(subActor.powerLevel);
    enemy = { name: subActor.name, ...s, isBoss: true, level: Math.max(8, Math.round(subActor.powerLevel / 2.4)), personality: subActor.personality ?? undefined, worldActorId: subActor.id };
    vanguardName = subActor.name;
  } else {
    const roster = await loadRoster(me.currentIslandId);
    const engaged = await engagedNpcIds(me.id);
    const res = roster.filter((n) => isFighter(n.category) && npcState(n, new Date(), engaged).usable).sort((a, b) => b.level - a.level)[0];
    if (res) {
      const s = npcStats(res.level, res.category);
      enemy = { name: res.name, ...s, isBoss: false, level: res.level, personality: res.personality, islandNpcId: res.id };
      vanguardName = res.name;
    }
  }

  const challenge = await prisma.canonChallenge.create({ data: { characterId: me.id, actorId: actor.id, actorName: actor.name, islandId: me.currentIslandId, stage: enemy ? "VANGUARD" : "READY", note: enemy ? `Primero ${vanguardName}` : "Nadie de los suyos se interpone" } });
  if (!enemy) {
    return { log: [`Nadie se interpone entre tú y ${actor.name}. Puedes enfrentarlo cuando quieras (tienes 24 h).`] };
  }
  try {
    const started = await startJointFight({
      kind: "canon_vanguard",
      characterIds: await freePartyMemberIds(me.id),
      enemy,
      rewards: { berries: (subActor?.powerLevel ?? 20) * 4000, xp: (subActor?.powerLevel ?? 20) * 4, bounty: (subActor?.powerLevel ?? 20) * 100_000, islandDanger: 9 },
      stakes: `Para llegar hasta ${actor.name} hay que pasar sobre ${vanguardName} y los suyos.`,
      context: { challengeId: challenge.id },
    });
    return { log: started.log.length ? started.log : [`${vanguardName} sale a cortarte el paso: para llegar hasta ${actor.name} tendrás que vencerlo primero.`] };
  } catch (err) {
    await prisma.canonChallenge.delete({ where: { id: challenge.id } });
    if (err instanceof JointFightError) throw new CanonError(err.message);
    throw err;
  }
}

/** After the vanguard falls: face the canon character in person. */
export async function startCanonDuel(characterId: string, userId: string): Promise<{ log: string[] }> {
  const me = await loadOwned(characterId, userId);
  const ch = await prisma.canonChallenge.findFirst({ where: { characterId, stage: "READY" } });
  if (!ch) throw new CanonError("No tienes a nadie esperándote: primero hay que abrir un desafío.");
  const actor = await prisma.worldActor.findUnique({ where: { id: ch.actorId } });
  if (Date.now() - ch.updatedAt.getTime() > CANON_CHALLENGE_WINDOW_MS || !actor || actor.status !== "ACTIVE" || actor.locationHidden || actor.currentIslandId !== me.currentIslandId) {
    await prisma.canonChallenge.update({ where: { id: ch.id }, data: { stage: "EXPIRED", note: "Se te pasó la ocasión: ya no está a tu alcance." } });
    throw new CanonError(`${ch.actorName} ya no está a tu alcance: el desafío se ha perdido.`);
  }
  const s = duelEnemyOf(actor.powerLevel);
  try {
    const started = await startJointFight({
      kind: "canon",
      characterIds: await freePartyMemberIds(me.id),
      enemy: { name: actor.name, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, isBoss: true, level: s.level, personality: actor.personality ?? undefined, worldActorId: actor.id, isActor: true },
      rewards: { berries: actor.powerLevel * 15_000, xp: actor.powerLevel * 6, bounty: actor.powerLevel * 250_000, islandDanger: 9 },
      stakes: `${me.name} se enfrenta en persona a ${actor.name} en ${me.currentIsland.name}.`,
      context: { challengeId: ch.id },
    });
    await prisma.canonChallenge.update({ where: { id: ch.id }, data: { stage: "DUEL", note: null } });
    return { log: started.log.length ? started.log : [`${actor.name} da un paso al frente: el duelo empieza.`] };
  } catch (err) {
    if (err instanceof JointFightError) throw new CanonError(err.message);
    throw err;
  }
}

/** Called by joint-fight.ts when a canon fight ends. */
export async function handleCanonFightSettled(p: { kind: string; contextJson: string; outcome: "victory" | "defeat" | null; humans: { characterId: string; status: string; name: string }[] }): Promise<string[]> {
  const ctx = JSON.parse(p.contextJson) as { challengeId?: string };
  const ch = ctx.challengeId ? await prisma.canonChallenge.findUnique({ where: { id: ctx.challengeId } }) : null;
  if (!ch) return [];
  if (p.outcome !== "victory") {
    await prisma.canonChallenge.update({ where: { id: ch.id }, data: { stage: "LOST", note: p.kind === "canon" ? `${ch.actorName} os venció.` : "Los suyos os frenaron." } });
    return [`El desafío contra ${ch.actorName} termina aquí.`];
  }
  const names = p.humans.filter((h) => h.status !== "DOWN").map((h) => h.name).join(", ");
  if (p.kind === "canon_vanguard") {
    await prisma.canonChallenge.update({ where: { id: ch.id }, data: { stage: "READY", note: "El camino está libre" } });
    return [`Los que guardaban a ${ch.actorName} han caído. Ahora puedes plantarle cara en persona (tienes 24 h).`];
  }
  await prisma.canonChallenge.update({ where: { id: ch.id }, data: { stage: "WON", note: "Elige su destino" } });
  const actor = await prisma.worldActor.findUnique({ where: { id: ch.actorId } });
  if (actor) {
    await prisma.worldActor.update({ where: { id: actor.id }, data: { busyUntil: new Date(Date.now() + WON_EXPIRY_MS), currentFocus: `A merced de ${names || "sus vencedores"}` } });
    invalidateWorldState();
  }
  await postNews(`${names} derrota${p.humans.length > 1 ? "n" : ""} a ${ch.actorName}`, `${ch.actorName} ha caído ante ${names}. Su destino está por decidir.`, "Guerra", ch.characterId, "major", { islandId: ch.islandId });
  return [`¡${ch.actorName} está vencido! ${(await prisma.character.findUnique({ where: { id: ch.characterId }, select: { name: true } }))?.name ?? "Quien empezó el desafío"} decide su destino: capturarlo, matarlo o perdonarlo. Capturar o matar necesita la confirmación del administrador.`];
}

/** The winner chooses. Spare is immediate; capture and kill go to the owner as a player_verdict world event. */
export async function submitCanonVerdict(characterId: string, userId: string, choiceRaw: unknown): Promise<{ log: string[] }> {
  if (!isVerdictChoice(choiceRaw)) throw new CanonError("Elige capturarlo, matarlo o perdonarlo.");
  const choice: VerdictChoice = choiceRaw;
  const me = await loadOwned(characterId, userId).catch(async (e) => {
    // A winner may be hurt but must still be alive; everything else is an error.
    throw e;
  });
  const ch = await prisma.canonChallenge.findFirst({ where: { characterId, stage: "WON" } });
  if (!ch) throw new CanonError("No hay nadie a tu merced.");
  const claimed = await prisma.canonChallenge.updateMany({ where: { id: ch.id, stage: "WON" }, data: { stage: choice === "spare" ? "DONE" : "AWAITING_OWNER" } });
  if (claimed.count === 0) throw new CanonError("Ya elegiste.");
  const actor = await prisma.worldActor.findUnique({ where: { id: ch.actorId } });
  const place = me.currentIsland.name;
  if (choice === "spare") {
    if (actor) {
      await prisma.worldActor.update({ where: { id: actor.id }, data: { busyUntil: new Date(Date.now() + 24 * 3600_000), currentFocus: `Recuperándose de su derrota ante ${me.name}`, locationHidden: true, locationUpdatedAt: new Date() } });
      await recordMercyIncident(actor.id, me.id, `${me.name} le perdonó la vida en ${place}`);
      await addStanding(actor.id, me.id, { mercy: true }, `perdonaste a ${actor.name}`);
    }
    await prisma.canonChallenge.update({ where: { id: ch.id }, data: { note: `Perdonaste a ${ch.actorName}` } });
    await postNews(`${me.name} perdona la vida a ${ch.actorName}`, `Tras derrotarlo en ${place}, ${me.name} ha dejado marchar a ${ch.actorName}. Nadie duda de que no lo olvidará.`, "Guerra", me.id, "major", { islandId: me.currentIslandId });
    invalidateWorldState();
    return { log: [`Perdonas a ${ch.actorName}: se marcha, herido en el orgullo. No lo olvidará.`] };
  }
  const asked = choice === "death" ? "MATARLO" : "CAPTURARLO";
  const arc = await prisma.worldArc.create({
    data: {
      kind: "player_verdict",
      title: `${me.name} ha derrotado a ${ch.actorName}`,
      targetActorId: ch.actorId,
      targetName: ch.actorName,
      aggressorName: me.name,
      stage: 1,
      totalStages: 1,
      status: "AWAITING_CONSENT",
      consent: "PENDING",
      nextBeatAt: new Date(),
      requestedChoice: choice,
      requestedById: me.id,
      requestedByName: me.name,
      contextJson: JSON.stringify([`${me.name} derrotó en persona a ${ch.actorName} en ${place}.`, `${me.name} pide ${asked}.`]),
    },
  });
  await prisma.canonChallenge.update({ where: { id: ch.id }, data: { verdictArcId: arc.id, note: `Pediste ${asked}: esperando la confirmación del administrador` } });
  return { log: [`Pides ${asked} a ${ch.actorName}. El administrador tiene que confirmarlo: hasta entonces queda a tu merced.`] };
}

/** Called after the owner decides a player_verdict event: pays the winner and tells them what happened. */
export async function onPlayerVerdictDecided(arcId: string, outcome: "death" | "capture" | "survived"): Promise<void> {
  const ch = await prisma.canonChallenge.findFirst({ where: { verdictArcId: arcId } });
  if (!ch) return;
  const me = await prisma.character.findUnique({ where: { id: ch.characterId } });
  const actor = await prisma.worldActor.findUnique({ where: { id: ch.actorId } });
  await prisma.canonChallenge.update({ where: { id: ch.id }, data: { stage: "DONE", note: outcome === "survived" ? `El administrador no lo permitió: ${ch.actorName} escapó.` : outcome === "capture" ? `${ch.actorName} quedó capturado en Impel Down.` : `${ch.actorName} murió.` } });
  if (!me) return;
  const reward = verdictReward(actor?.powerLevel ?? 60, actor?.canonBounty != null ? Number(actor.canonBounty) : null, outcome);
  const lines: string[] = [];
  if (reward.berries > 0) {
    await prisma.character.update({ where: { id: me.id }, data: { berries: { increment: reward.berries } } });
    lines.push(`recibes ฿ ${reward.berries.toLocaleString("es-ES")}`);
    const log: string[] = [];
    await applyBountyOrNotoriety(me, me.faction === "PIRATE" || me.faction === "BOUNTY_HUNTER" ? reward.standing * 400_000 : reward.standing * 20, log, `Acabó con ${ch.actorName}`);
    lines.push(...log);
  }
  await prisma.gameLogEntry.create({ data: { characterId: me.id, kind: "world", text: `Veredicto sobre ${ch.actorName}: ${outcome === "survived" ? "el administrador no permitió tu petición y escapó" : outcome === "capture" ? "capturado y enviado a Impel Down" : "ha muerto"}${lines.length ? ` (${lines.join("; ")})` : ""}.` } });
}

export async function tickCanonChallenges(now = new Date()): Promise<void> {
  await prisma.canonChallenge.updateMany({ where: { stage: "READY", updatedAt: { lt: new Date(now.getTime() - CANON_CHALLENGE_WINDOW_MS) } }, data: { stage: "EXPIRED", note: "Se te pasó la ocasión" } });
  await prisma.canonChallenge.updateMany({ where: { stage: "WON", updatedAt: { lt: new Date(now.getTime() - WON_EXPIRY_MS) } }, data: { stage: "EXPIRED", note: "No elegiste a tiempo: se marchó" } });
}

