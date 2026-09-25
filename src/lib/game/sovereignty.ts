import { prisma } from "../db";
import { ActorRole, CharacterStatus, type Character, type Territory, type War } from "@prisma/client";
import {
  baseGarrisonStats,
  canBeProclaimed,
  challengeBlockReason,
  declareWarBlockReason,
  emperorChallengeRewards,
  emperorEnemyStats,
  emperorRequirements,
  EMPEROR_TITLE,
  figureLabel,
  figureNewsDue,
  isMarineBase,
  isWorldFigure,
  parseFallenFate,
  revokedBounty,
  rivalGarrisonStats,
  tributeState,
  warlordRequirements,
  warlordTribute,
  warOutcome,
  warRewards,
  WARLORD_TITLE,
  WARLORD_TRIBUTE_PERIOD_MS,
  WAR_DURATION_MS,
  type FallenFate,
  type WarKind,
} from "../engine/sovereignty";
import { actorCombatStats } from "../engine/guardian";
import { factionTitle, type FactionKey } from "../engine/progression";
import { ARC_TOTAL_STAGES } from "../engine/world-arcs";
import { GARRISON_MAX } from "../engine/territory";
import { postNews } from "./death-resolution";
import { recordGrudgeIncident } from "./grudges";
import { notifyIsland } from "./notify";
import { startJointFight, freePartyMemberIds, getOpenJointFightFor, JointFightError } from "./joint-fight";

export class SovereigntyError extends Error {}

const DAY = 24 * 3600_000;

const parse = <T>(json: string | null | undefined, fallback: T): T => {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
};

// Characters crowned before thrones were tracked (the owner's make-yonko script) carry it in their title.
export const isEmperor = (c: Pick<Character, "emperorSince" | "title">) => !!c.emperorSince || /\byonko\b|emperador/i.test(c.title ?? "");
export const isWarlord = (c: Pick<Character, "warlordSince">) => !!c.warlordSince;

/** Canon warlords still sitting on the council (the "Ex-" ones only live in the codex). */
async function warlordSeatsTaken(): Promise<number> {
  const [canon, players] = await Promise.all([
    prisma.worldActor.findMany({ where: { role: ActorRole.WARLORD, status: "ACTIVE" }, select: { rankLabel: true } }),
    prisma.character.count({ where: { warlordSince: { not: null }, status: { not: CharacterStatus.DEAD } } }),
  ]);
  return canon.filter((a) => !/^ex/i.test(a.rankLabel ?? "")).length + players;
}

async function emperorsNow(): Promise<number> {
  const [canon, players] = await Promise.all([
    prisma.worldActor.count({ where: { role: ActorRole.YONKO, status: "ACTIVE" } }),
    prisma.character.count({ where: { emperorSince: { not: null }, status: { not: CharacterStatus.DEAD } } }),
  ]);
  return canon + players;
}

async function forcesOf(c: Character): Promise<number> {
  const [mates, npcs] = await Promise.all([
    c.crewId ? prisma.character.count({ where: { crewId: c.crewId, id: { not: c.id }, status: CharacterStatus.ALIVE } }) : 0,
    prisma.nPCCompanion.count({ where: { characterId: c.id, status: CharacterStatus.ALIVE } }),
  ]);
  return mates + npcs;
}

const territoriesOf = (characterId: string) => prisma.territory.findMany({ where: { ownerCharacterId: characterId } });

async function islandNames(): Promise<Map<string, { name: string; dangerLevel: number; factionControl: string | null }>> {
  const all = await prisma.island.findMany({ select: { id: true, name: true, dangerLevel: true, factionControl: true } });
  return new Map(all.map((i) => [i.id, i]));
}

async function loadMine(characterId: string, userId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me || me.userId !== userId) throw new SovereigntyError("Personaje no encontrado.");
  return me;
}

// ---------------------------------------------------------------- lazy upkeep

async function revokeWarlord(c: Character, why: string, headline?: string): Promise<void> {
  const bounty = revokedBounty(c.bounty);
  await prisma.character.update({
    where: { id: c.id },
    data: { warlordSince: null, warlordTributeDueAt: null, warlordRevokedAt: new Date(), bounty, ...(c.title === WARLORD_TITLE ? { title: null } : {}) },
  });
  await postNews(headline ?? `El Gobierno Mundial revoca la patente de ${c.name}`, `${why} Su recompensa vuelve a estar activa: ฿ ${bounty.toLocaleString("es-ES")}.`, "Gobierno Mundial", c.id, "major");
}

/** Everything the passage of time decides: unpaid tributes cost the licence, wars end on their deadline. */
export async function refreshSovereignty(characterId: string, now = new Date()): Promise<void> {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c) return;
  if (c.warlordSince && tributeState(c.warlordTributeDueAt, now) === "overdue") {
    await revokeWarlord(c, `${c.name} dejó de pagar al Gobierno la parte que le correspondía como Shichibukai.`);
  }
  const wars = await prisma.war.findMany({ where: { status: "ACTIVE", OR: [{ attackerId: characterId }, { defenderId: characterId }] } });
  for (const w of wars) await settleWarIfDone(w, now);
}

// ---------------------------------------------------------------- state for the panel

export async function getSovereigntyState(characterId: string, userId: string) {
  const me = await loadMine(characterId, userId);
  await refreshSovereignty(me.id);
  const c = (await prisma.character.findUnique({ where: { id: me.id }, include: { currentIsland: true } }))!;
  const now = new Date();
  const [territories, forces, seats, emperors, islands, wars] = await Promise.all([
    territoriesOf(c.id),
    forcesOf(c),
    warlordSeatsTaken(),
    emperorsNow(),
    islandNames(),
    prisma.war.findMany({ where: { OR: [{ attackerId: c.id }, { defenderId: c.id }] }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);
  const jailed = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
  const faction = c.faction as FactionKey;
  const emperor = emperorRequirements({ faction, alive: c.status === CharacterStatus.ALIVE, level: c.level, bounty: c.bounty, territories: territories.length, forces, isEmperor: isEmperor(c), isWarlord: isWarlord(c) });
  const warlord = warlordRequirements({ faction, alive: c.status === CharacterStatus.ALIVE, imprisoned: !!jailed && !jailed.releasedAt, level: c.level, bounty: c.bounty, isEmperor: isEmperor(c), isWarlord: isWarlord(c), seatsTaken: seats, revokedAt: c.warlordRevokedAt, now });

  const yonkoActors = await prisma.worldActor.findMany({ where: { role: ActorRole.YONKO, status: "ACTIVE" }, orderBy: { powerLevel: "desc" } });
  const playerEmperors = await prisma.character.findMany({ where: { emperorSince: { not: null }, status: { not: CharacterStatus.DEAD } }, select: { id: true, name: true, currentIslandId: true } });
  const where = (islandId: string | null, hidden: boolean) => (hidden || !islandId ? "Ubicación desconocida" : islands.get(islandId)?.name ?? "Ubicación desconocida");
  const government = c.faction === "MARINE" || c.faction === "CP0";
  // Any Marine or CP-0 fights in every war declared on the Marines, not only their own.
  const openWar = wars.find((w) => w.status === "ACTIVE") ?? (government ? await prisma.war.findFirst({ where: { status: "ACTIVE", kind: "MARINE" }, orderBy: { startedAt: "desc" } }) : null);
  const here = islands.get(c.currentIslandId);
  const hereTerritory = await prisma.territory.findUnique({ where: { islandId: c.currentIslandId } });

  return {
    faction,
    isEmperor: isEmperor(c),
    isWarlord: isWarlord(c),
    figure: isWorldFigure({ faction, bounty: c.bounty, notoriety: c.notoriety, isEmperor: isEmperor(c), isWarlord: isWarlord(c) }),
    emperor: {
      ...emperor,
      seatsTaken: emperors,
      canProclaim: canBeProclaimed(emperor.ok, emperors),
      thrones: [
        ...yonkoActors.map((a) => ({
          id: a.id,
          name: a.name,
          kind: "canon" as const,
          location: a.locationKind === "sea" ? "En el mar" : where(a.currentIslandId, a.locationHidden),
          here: !a.locationHidden && a.locationKind !== "sea" && a.currentIslandId === c.currentIslandId,
          block: challengeBlockReason({ eligible: emperor.ok, sameIsland: a.currentIslandId === c.currentIslandId && a.locationKind !== "sea", targetActive: a.status === "ACTIVE", targetIsEmperor: a.role === ActorRole.YONKO, lastChallengeAt: c.lastEmperorChallengeAt, now }),
        })),
        ...playerEmperors.filter((p) => p.id !== c.id).map((p) => ({ id: p.id, name: p.name, kind: "player" as const, location: where(p.currentIslandId, false), here: p.currentIslandId === c.currentIslandId, block: "Contra otro Yonko jugador se va a la guerra, no a un desafío." })),
      ],
    },
    warlord: {
      ...warlord,
      seatsTaken: seats,
      tribute: isWarlord(c) ? warlordTribute(c.bounty) : null,
      tributeDueAt: c.warlordTributeDueAt,
      tributeState: tributeState(c.warlordTributeDueAt, now),
    },
    war: openWar ? warView(openWar, c.id) : null,
    pastWars: wars.filter((w) => w.status !== "ACTIVE").map((w) => warView(w, c.id)),
    warTargets: isEmperor(c) && !wars.some((w) => w.status === "ACTIVE") ? playerEmperors.filter((p) => p.id !== c.id).map((p) => ({ id: p.id, name: p.name })) : [],
    here: {
      islandName: c.currentIsland.name,
      isMarineBase: isMarineBase(here?.factionControl),
      territoryOwner: hereTerritory?.ownerCharacterId ?? null,
      territoryOwnerName: hereTerritory?.ownerName ?? null,
    },
    canAssaultHere: openWar ? !!(await assaultTarget(openWar, c)) : false,
  };
}

function warView(w: War, me: string) {
  return {
    id: w.id,
    kind: w.kind as WarKind,
    status: w.status,
    iAmAttacker: w.attackerId === me,
    attackerName: w.attackerName,
    defenderName: w.defenderName,
    attackerScore: w.attackerScore,
    defenderScore: w.defenderScore,
    outcome: w.outcome,
    endsAt: new Date(w.startedAt.getTime() + WAR_DURATION_MS),
    log: parse<string[]>(w.logJson, []).slice(-6),
  };
}

// ---------------------------------------------------------------- Yonko

/** The world answers a new emperor: every other emperor and the admirals mark them, and the Marines send the fleet. */
async function worldReactsToEmperor(c: Character, homeIslandId: string | null): Promise<void> {
  const rivals = await prisma.worldActor.findMany({ where: { status: "ACTIVE", role: { in: [ActorRole.YONKO, ActorRole.ADMIRAL] } } });
  for (const r of rivals) {
    const s = actorCombatStats(Math.round(r.powerLevel * 0.7));
    const force = r.role === ActorRole.YONKO ? `Flota de ${r.name}` : `Escuadra del almirante ${r.name}`;
    await recordGrudgeIncident(r.id, c.id, "escape", `${c.name} se ha proclamado Emperador del mar: ${r.name} no piensa tolerarlo.`, force, s);
  }
  if (homeIslandId) {
    const { startBusterCall } = await import("./buster-call");
    await startBusterCall(homeIslandId, `La Marina responde a la proclamación de ${c.name} como Yonko.`);
  }
}

async function crownEmperor(c: Character, how: string, homeIslandId: string | null): Promise<void> {
  await prisma.character.update({ where: { id: c.id }, data: { emperorSince: new Date(), title: EMPEROR_TITLE } });
  await postNews(`${c.name} es reconocido como un nuevo Yonko`, how, "Guerra", c.id, "major");
  await worldReactsToEmperor(c, homeIslandId);
}

export async function proclaimEmperor(characterId: string, userId: string) {
  const c = await loadMine(characterId, userId);
  const territories = await territoriesOf(c.id);
  const req = emperorRequirements({ faction: c.faction as FactionKey, alive: c.status === CharacterStatus.ALIVE, level: c.level, bounty: c.bounty, territories: territories.length, forces: await forcesOf(c), isEmperor: isEmperor(c), isWarlord: isWarlord(c) });
  if (!req.ok) throw new SovereigntyError(`Aún no cumples los requisitos: ${req.checks.filter((x) => !x.met).map((x) => x.label).join(", ")}.`);
  if (!canBeProclaimed(true, await emperorsNow())) throw new SovereigntyError("Los cuatro tronos del mar están ocupados: tendrás que arrebatarle el suyo a un Emperador.");
  await crownEmperor(c, `Con una recompensa de ฿ ${c.bounty.toLocaleString("es-ES")}, dominios propios y una flota fiel, ${c.name} ocupa el trono vacío de los Emperadores del mar.`, territories[0]?.islandId ?? null);
  return { log: [`El mundo entero ya habla de ti: eres un Yonko.`] };
}

export async function challengeEmperor(characterId: string, userId: string, actorId: string, fateRaw: unknown) {
  const c = await loadMine(characterId, userId);
  const fate = parseFallenFate(fateRaw) ?? "spare";
  const actor = await prisma.worldActor.findUnique({ where: { id: actorId } });
  if (!actor) throw new SovereigntyError("Ese Emperador no existe.");
  const territories = await territoriesOf(c.id);
  const req = emperorRequirements({ faction: c.faction as FactionKey, alive: c.status === CharacterStatus.ALIVE, level: c.level, bounty: c.bounty, territories: territories.length, forces: await forcesOf(c), isEmperor: isEmperor(c), isWarlord: isWarlord(c) });
  const block = challengeBlockReason({
    eligible: req.ok,
    sameIsland: actor.currentIslandId === c.currentIslandId && actor.locationKind !== "sea",
    targetActive: actor.status === "ACTIVE",
    targetIsEmperor: actor.role === ActorRole.YONKO,
    lastChallengeAt: c.lastEmperorChallengeAt,
    now: new Date(),
  });
  if (block) throw new SovereigntyError(block);
  if (await getOpenJointFightFor(c.id)) throw new SovereigntyError("Ya estás metido en una pelea.");

  const stats = emperorEnemyStats(actor.powerLevel);
  try {
    const started = await startJointFight({
      kind: "sovereign",
      characterIds: await freePartyMemberIds(c.id),
      enemy: { name: actor.name, ...stats, isBoss: true, personality: actor.personality ?? undefined, worldActorId: actor.id, isActor: true },
      rewards: emperorChallengeRewards(c.currentIsland.dangerLevel),
      stakes: `Desafío por el trono de ${actor.name}: si cae, su lugar entre los Emperadores es tuyo.`,
      context: { op: "emperor", actorId: actor.id, challengerId: c.id, fate },
    });
    await prisma.character.update({ where: { id: c.id }, data: { lastEmperorChallengeAt: new Date() } });
    await postNews(`${c.name} desafía a ${actor.name}`, `En ${c.currentIsland.name}, ${c.name} ha plantado cara en persona a ${actor.name} y reclama su trono entre los Emperadores del mar. El mundo contiene el aliento.`, "Guerra", c.id, "major");
    await notifyIsland(c.currentIslandId, "sovereign");
    return { log: [`Desafías a ${actor.name}. Todos los que luchan contigo describen su movimiento.`], fightId: started.fightId };
  } catch (err) {
    if (err instanceof JointFightError) throw new SovereigntyError(err.message);
    throw err;
  }
}

/** A dethroned canon emperor keeps living (or not) only by the owner's verdict: a capture or a death is asked, never applied. */
async function askVerdictOnFallen(actorId: string, actorName: string, winner: Character, fate: FallenFate, place: string): Promise<void> {
  if (fate === "spare") return;
  await prisma.worldArc.create({
    data: {
      kind: fate === "kill" ? "death" : "capture",
      title: `El destino de ${actorName}`,
      targetActorId: actorId,
      targetName: actorName,
      aggressorName: winner.name,
      stage: ARC_TOTAL_STAGES,
      totalStages: ARC_TOTAL_STAGES,
      status: "AWAITING_CONSENT",
      consent: "PENDING",
      nextBeatAt: new Date(),
      contextJson: JSON.stringify([`${winner.name} derrotó en persona a ${actorName} en ${place} y le arrebató su trono de Emperador.`, `${winner.name} quiere ${fate === "kill" ? "acabar con su vida" : "entregarlo prisionero"}.`]),
    },
  });
}

async function dethrone(actorId: string, winner: Character, fate: FallenFate): Promise<string[]> {
  const actor = await prisma.worldActor.findUnique({ where: { id: actorId } });
  if (!actor || actor.role !== ActorRole.YONKO) return [];
  const place = (await prisma.island.findUnique({ where: { id: winner.currentIslandId } }))?.name ?? "su isla";
  await prisma.worldActor.update({ where: { id: actor.id }, data: { role: ActorRole.NOTABLE_PIRATE, rankLabel: `Ex-Yonko (destronado por ${winner.name})`, currentFocus: "Destronado", busyUntil: new Date(Date.now() + DAY) } });
  const held = await prisma.territory.findMany({ where: { ownerActorId: actor.id } });
  for (const t of held) await handOver(t, winner, `Yonko de ${(await prisma.island.findUnique({ where: { id: t.islandId } }))?.name ?? "la isla"}`);
  await crownEmperor(winner, `${winner.name} ha derrotado a ${actor.name} en ${place} y ocupa su trono entre los Emperadores del mar. ${held.length ? `Sus dominios pasan a la bandera de ${winner.name}.` : ""}`, held[0]?.islandId ?? (await territoriesOf(winner.id))[0]?.islandId ?? null);
  await askVerdictOnFallen(actor.id, actor.name, winner, fate, place);
  return [`¡${actor.name} cae! ${winner.name} ocupa su trono entre los Emperadores.${fate === "spare" ? " Le perdonas la vida." : " Su destino final queda en manos del mundo (a la espera del veredicto)."}`];
}

async function handOver(t: Territory, winner: Character, title: string): Promise<void> {
  const crew = winner.crewId ? await prisma.crew.findUnique({ where: { id: winner.crewId } }) : null;
  await prisma.territory.update({
    where: { id: t.id },
    data: { ownerActorId: null, ownerCharacterId: winner.id, ownerCrewId: winner.crewId, ownerName: crew ? `${crew.name} (${winner.name})` : winner.name, title, status: "HELD", stage: "ARMY", garrison: GARRISON_MAX, lastPressureAt: new Date(), lastIncomeAt: new Date(), contributionsJson: "{}", votesJson: "{}", musterJson: "[]" },
  });
}

// ---------------------------------------------------------------- Shichibukai

export async function applyForWarlord(characterId: string, userId: string) {
  const c = await loadMine(characterId, userId);
  const jailed = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
  const req = warlordRequirements({ faction: c.faction as FactionKey, alive: c.status === CharacterStatus.ALIVE, imprisoned: !!jailed && !jailed.releasedAt, level: c.level, bounty: c.bounty, isEmperor: isEmperor(c), isWarlord: isWarlord(c), seatsTaken: await warlordSeatsTaken(), revokedAt: c.warlordRevokedAt, now: new Date() });
  if (isWarlord(c)) throw new SovereigntyError("Ya eres un Shichibukai.");
  if (!req.ok) throw new SovereigntyError(`El Gobierno rechaza tu solicitud: ${req.checks.filter((x) => !x.met).map((x) => x.detail).join(" · ")}`);
  await prisma.character.update({ where: { id: c.id }, data: { warlordSince: new Date(), warlordTributeDueAt: new Date(Date.now() + WARLORD_TRIBUTE_PERIOD_MS), ...(c.title ? {} : { title: WARLORD_TITLE }) } });
  await postNews(
    `${c.name}, nuevo Shichibukai`,
    `El Gobierno Mundial ha concedido una patente de corso a ${c.name}: su recompensa queda congelada y la Marina no le perseguirá mientras entregue al Gobierno su parte (฿ ${warlordTribute(c.bounty).toLocaleString("es-ES")} cada siete días).`,
    "Gobierno Mundial",
    c.id,
    "major"
  );
  return { log: ["El Gobierno firma tu patente: eres uno de los Siete Señores de la Guerra del Mar."] };
}

export async function payWarlordTribute(characterId: string, userId: string) {
  const c = await loadMine(characterId, userId);
  if (!isWarlord(c)) throw new SovereigntyError("No tienes ninguna patente que pagar.");
  const amount = warlordTribute(c.bounty);
  if (c.berries < amount) throw new SovereigntyError(`El tributo es de ฿ ${amount.toLocaleString("es-ES")} y no los tienes.`);
  const base = c.warlordTributeDueAt && c.warlordTributeDueAt.getTime() > Date.now() ? c.warlordTributeDueAt.getTime() : Date.now();
  const saved = await prisma.character.updateMany({ where: { id: c.id, berries: c.berries }, data: { berries: c.berries - amount, warlordTributeDueAt: new Date(base + WARLORD_TRIBUTE_PERIOD_MS) } });
  if (saved.count === 0) throw new SovereigntyError("Tu bolsa ha cambiado mientras pagabas: inténtalo otra vez.");
  return { log: [`Entregas ฿ ${amount.toLocaleString("es-ES")} al Gobierno Mundial. Tu patente sigue en vigor otra semana.`] };
}

export async function resignWarlord(characterId: string, userId: string) {
  const c = await loadMine(characterId, userId);
  if (!isWarlord(c)) throw new SovereigntyError("No eres un Shichibukai.");
  await revokeWarlord(c, `${c.name} ha roto su patente con el Gobierno Mundial por voluntad propia.`, `${c.name} renuncia a su título de Shichibukai`);
  return { log: ["Rompes tu patente. Vuelves a ser un pirata libre... y perseguido."] };
}

/** Called when a warlord kills a Government player: the licence ends the same day. */
export async function warlordBetrayal(characterId: string, victimName: string): Promise<void> {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (c?.warlordSince) await revokeWarlord(c, `${c.name} ha dado muerte a ${victimName}, de las fuerzas del Gobierno.`);
}

// ---------------------------------------------------------------- Wars

function logLine(w: War, line: string): string {
  return JSON.stringify([...parse<string[]>(w.logJson, []), line].slice(-20));
}

export async function declareWar(characterId: string, userId: string, kindRaw: unknown, targetId?: string) {
  const c = await loadMine(characterId, userId);
  const kind: WarKind = kindRaw === "EMPEROR" ? "EMPEROR" : "MARINE";
  const open = await prisma.war.findFirst({ where: { status: "ACTIVE", OR: [{ attackerId: c.id }, { defenderId: c.id }] } });
  const last = await prisma.war.findFirst({ where: { attackerId: c.id, status: "ENDED" }, orderBy: { endedAt: "desc" } });
  let target: Character | null = null;
  if (kind === "EMPEROR") {
    target = targetId ? await prisma.character.findUnique({ where: { id: targetId } }) : null;
    if (!target || target.status === CharacterStatus.DEAD) throw new SovereigntyError("Ese rival no existe.");
    if (await prisma.war.findFirst({ where: { status: "ACTIVE", OR: [{ attackerId: target.id }, { defenderId: target.id }] } })) throw new SovereigntyError(`${target.name} ya está en guerra con otro.`);
  }
  const block = declareWarBlockReason({ isEmperor: isEmperor(c), hasOpenWar: !!open, lastWarEndedAt: last?.endedAt ?? null, now: new Date(), ...(kind === "EMPEROR" ? { targetIsEmperor: !!target?.emperorSince, targetIsSelf: target?.id === c.id } : {}) });
  if (block) throw new SovereigntyError(block);

  const defenderName = kind === "MARINE" ? "la Marina" : target!.name;
  const war = await prisma.war.create({ data: { kind, attackerId: c.id, attackerName: c.name, defenderId: target?.id ?? null, defenderName, logJson: JSON.stringify([`${c.name} declara la guerra a ${defenderName}.`]) } });
  await postNews(
    kind === "MARINE" ? `¡${c.name} declara la guerra a la Marina!` : `Guerra entre Emperadores: ${c.name} contra ${defenderName}`,
    kind === "MARINE"
      ? `El Yonko ${c.name} ha declarado la guerra abierta a la Marina: sus bases están en el punto de mira. El Cuartel General moviliza a sus almirantes y cualquier marine puede contraatacar sus dominios.`
      : `El Yonko ${c.name} ha declarado la guerra a ${defenderName}. Sus dominios quedan expuestos: el primero que tome tres golpes decisivos gana la guerra.`,
    "Guerra",
    c.id,
    "major"
  );
  if (kind === "MARINE") {
    const home = (await territoriesOf(c.id))[0];
    if (home) {
      const { startBusterCall } = await import("./buster-call");
      await startBusterCall(home.islandId, `La Marina responde a la declaración de guerra de ${c.name}.`);
    }
  }
  return { log: [`La guerra ha comenzado: ${defenderName} es ahora tu enemigo. Tres victorias decisivas la ganan.`], warId: war.id };
}

/** What can be assaulted where this character stands, inside the war it is part of (or for Marines, any war against them). */
async function assaultTarget(w: War, c: Character): Promise<{ kind: "base" | "territory"; territory?: Territory; side: "attacker" | "defender" } | null> {
  const island = await prisma.island.findUnique({ where: { id: c.currentIslandId } });
  if (!island) return null;
  const t = await prisma.territory.findUnique({ where: { islandId: c.currentIslandId } });
  if (w.kind === "MARINE") {
    if (w.attackerId === c.id) return isMarineBase(island.factionControl) ? { kind: "base", side: "attacker" } : null;
    if ((c.faction === "MARINE" || c.faction === "CP0") && t?.ownerCharacterId === w.attackerId) return { kind: "territory", territory: t, side: "defender" };
    return null;
  }
  const enemy = w.attackerId === c.id ? w.defenderId : w.defenderId === c.id ? w.attackerId : null;
  if (!enemy || !t || t.ownerCharacterId !== enemy) return null;
  return { kind: "territory", territory: t, side: w.attackerId === c.id ? "attacker" : "defender" };
}

export async function warAssault(characterId: string, userId: string) {
  const c = await loadMine(characterId, userId);
  if (c.status !== CharacterStatus.ALIVE) throw new SovereigntyError("No estás en condiciones de luchar.");
  const war =
    (await prisma.war.findFirst({ where: { status: "ACTIVE", OR: [{ attackerId: c.id }, { defenderId: c.id }] } })) ??
    ((c.faction === "MARINE" || c.faction === "CP0") ? await prisma.war.findFirst({ where: { status: "ACTIVE", kind: "MARINE" }, orderBy: { startedAt: "desc" } }) : null);
  if (!war) throw new SovereigntyError("No hay ninguna guerra en la que puedas golpear.");
  await settleWarIfDone(war, new Date());
  const fresh = await prisma.war.findUniqueOrThrow({ where: { id: war.id } });
  if (fresh.status !== "ACTIVE") throw new SovereigntyError("Esa guerra acaba de terminar.");
  const target = await assaultTarget(fresh, c);
  if (!target) throw new SovereigntyError(fresh.kind === "MARINE" ? "Aquí no hay nada que asaltar en esta guerra: busca una base de la Marina (o, si eres marine, un dominio del Yonko enemigo)." : "Aquí no hay ningún dominio de tu enemigo.");
  if (await getOpenJointFightFor(c.id)) throw new SovereigntyError("Ya estás metido en una pelea.");

  let enemy: { name: string; hp: number; atk: number; def: number; spd: number; isBoss: boolean; personality?: string; worldActorId?: string; isActor?: boolean };
  if (target.kind === "base") {
    const admiral = await prisma.worldActor.findFirst({ where: { role: { in: [ActorRole.ADMIRAL, ActorRole.MARINE_GENERAL] }, status: "ACTIVE", currentIslandId: c.currentIslandId, locationHidden: false, OR: [{ busyUntil: null }, { busyUntil: { lt: new Date() } }] }, orderBy: { powerLevel: "desc" } });
    enemy = admiral
      ? { name: admiral.name, ...actorCombatStats(admiral.powerLevel), isBoss: true, personality: admiral.personality ?? undefined, worldActorId: admiral.id, isActor: true }
      : { name: `Guarnición de ${c.currentIsland.name}`, ...baseGarrisonStats(c.currentIsland.dangerLevel, c.level), isBoss: true, personality: "disciplina marina: resisten hasta el último hombre" };
  } else {
    const owner = await prisma.character.findUnique({ where: { id: target.territory!.ownerCharacterId! } });
    enemy = { name: `Guarnición de ${target.territory!.ownerName}`, ...rivalGarrisonStats(target.territory!.garrison, owner?.level ?? 30), isBoss: true, personality: "leales a su Emperador, defienden cada palmo de la isla" };
  }
  try {
    const started = await startJointFight({
      kind: "sovereign",
      characterIds: await freePartyMemberIds(c.id),
      enemy,
      rewards: warRewards(fresh.kind as WarKind, c.currentIsland.dangerLevel),
      stakes: `Guerra de ${fresh.attackerName} contra ${fresh.defenderName}: un golpe decisivo en ${c.currentIsland.name}.`,
      context: { op: "war", warId: fresh.id, side: target.side, territoryId: target.territory?.id ?? null, assaulterId: c.id },
    });
    await notifyIsland(c.currentIslandId, "sovereign");
    return { log: [`¡Al asalto de ${enemy.name}! Todos describen su movimiento.`], fightId: started.fightId };
  } catch (err) {
    if (err instanceof JointFightError) throw new SovereigntyError(err.message);
    throw err;
  }
}

async function settleWarIfDone(w: War, now: Date): Promise<void> {
  if (w.status !== "ACTIVE") return;
  const result = warOutcome({ attacker: w.attackerScore, defender: w.defenderScore }, w.startedAt, now);
  if (!result) return;
  const claimed = await prisma.war.updateMany({ where: { id: w.id, status: "ACTIVE" }, data: { status: "ENDED", outcome: result, endedAt: now } });
  if (claimed.count === 0) return;
  const attacker = await prisma.character.findUnique({ where: { id: w.attackerId } });
  if (result === "attacker" && attacker) {
    const bounty = Math.round(attacker.bounty * 1.25);
    await prisma.character.update({ where: { id: attacker.id }, data: { bounty } });
    await postNews(`${w.attackerName} gana la guerra contra ${w.defenderName}`, `Tras ${w.attackerScore} golpes decisivos, ${w.defenderName} ${w.kind === "MARINE" ? "retira sus flotas" : "reconoce la derrota"}. La recompensa de ${w.attackerName} sube a ฿ ${bounty.toLocaleString("es-ES")}.`, "Guerra", attacker.id, "major");
  } else if (result === "defender") {
    if (w.kind === "MARINE") {
      const lost = (await territoriesOf(w.attackerId))[0];
      if (lost) {
        const { loseTerritoryToFleet } = await import("./territory");
        await loseTerritoryToFleet(lost.islandId);
      }
    }
    await postNews(`${w.defenderName} vence en la guerra contra ${w.attackerName}`, `${w.attackerName} no logró doblegar a ${w.defenderName} y paga el precio de su derrota${w.kind === "MARINE" ? ": la Marina recupera uno de sus dominios" : ""}.`, "Guerra", attacker?.id, "major");
  } else {
    await postNews(`Tregua entre ${w.attackerName} y ${w.defenderName}`, `Siete días de guerra sin un vencedor claro: ambos bandos se retiran a lamer sus heridas.`, "Guerra", attacker?.id, "normal");
  }
}

// ---------------------------------------------------------------- joint fight settlement

export async function handleSovereignFightSettled(p: { contextJson: string; outcome: "victory" | "defeat" | null; humans: { characterId: string; status: string; name: string }[] }): Promise<string[]> {
  const ctx = parse<{ op?: string; actorId?: string; challengerId?: string; fate?: FallenFate; warId?: string; side?: "attacker" | "defender"; territoryId?: string | null; assaulterId?: string }>(p.contextJson, {});
  if (ctx.op === "emperor" && ctx.actorId && ctx.challengerId) {
    if (p.outcome !== "victory") return [];
    const winner = await prisma.character.findUnique({ where: { id: ctx.challengerId } });
    if (!winner || winner.status === CharacterStatus.DEAD) return [];
    return dethrone(ctx.actorId, winner, ctx.fate ?? "spare");
  }
  if (ctx.op === "war" && ctx.warId) {
    const w = await prisma.war.findUnique({ where: { id: ctx.warId } });
    if (!w || w.status !== "ACTIVE" || !p.outcome) return [];
    const lines: string[] = [];
    const scorer = p.outcome === "victory" ? ctx.side : ctx.side === "attacker" ? "defender" : "attacker";
    const place = p.humans[0] ? (await prisma.character.findUnique({ where: { id: p.humans[0].characterId }, include: { currentIsland: true } }))?.currentIsland.name ?? "el frente" : "el frente";
    const line = p.outcome === "victory" ? `${p.humans.map((h) => h.name).join(", ")} gana un golpe decisivo en ${place}.` : `El asalto en ${place} fracasa.`;
    await prisma.war.update({ where: { id: w.id }, data: { ...(scorer === "attacker" ? { attackerScore: { increment: 1 } } : { defenderScore: { increment: 1 } }), logJson: logLine(w, line) } });
    lines.push(line);
    if (p.outcome === "victory" && ctx.territoryId) {
      const t = await prisma.territory.findUnique({ where: { id: ctx.territoryId } });
      const taker = ctx.assaulterId ? await prisma.character.findUnique({ where: { id: ctx.assaulterId } }) : null;
      if (t && taker) {
        const islandName = (await prisma.island.findUnique({ where: { id: t.islandId } }))?.name ?? "la isla";
        if (taker.faction === "MARINE" || taker.faction === "CP0") {
          const { loseTerritoryToFleet } = await import("./territory");
          await loseTerritoryToFleet(t.islandId);
          lines.push(`La Marina arrebata ${islandName} al Yonko.`);
        } else {
          await handOver(t, taker, `${isEmperor(taker) ? "Yonko" : "Señor"} de ${islandName}`);
          lines.push(`${taker.name} toma ${islandName}.`);
          await postNews(`${taker.name} arrebata ${islandName} a su rival`, `En plena guerra entre Emperadores, ${taker.name} ha tomado ${islandName}.`, "Guerra", taker.id, "major");
        }
      }
    }
    await settleWarIfDone((await prisma.war.findUniqueOrThrow({ where: { id: w.id } })), new Date());
    return lines;
  }
  return [];
}

// ---------------------------------------------------------------- world figures in the news

/**
 * The papers follow the powerful: an emperor, a warlord or the top of any ladder makes the news wherever they
 * go and whatever big thing they do. Throttled per person so the paper never becomes one character's diary.
 */
export async function reportFigure(characterId: string, headline: (who: string) => string, body: (who: string) => string, opts: { severity?: "normal" | "major"; force?: boolean } = {}): Promise<boolean> {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c || c.status === CharacterStatus.DEAD) return false;
  const faction = c.faction as FactionKey;
  const flags = { faction, bounty: c.bounty, notoriety: c.notoriety, isEmperor: isEmperor(c), isWarlord: isWarlord(c) };
  if (!isWorldFigure(flags)) return false;
  const now = new Date();
  if (!opts.force && !figureNewsDue(c.lastFigureNewsAt, now)) return false;
  const claimed = await prisma.character.updateMany({ where: { id: c.id, lastFigureNewsAt: c.lastFigureNewsAt }, data: { lastFigureNewsAt: now } });
  if (claimed.count === 0) return false;
  const who = `${figureLabel(flags, factionTitle(faction, c.bounty, c.notoriety))} ${c.name}`;
  await postNews(headline(who), body(who), "Figuras del mundo", c.id, opts.severity ?? "normal");
  return true;
}
