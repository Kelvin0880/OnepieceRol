import { prisma } from "../db";
import { CharacterStatus } from "@prisma/client";
import { arcEligible, arcTitle, ARC_TOTAL_STAGES, RECLAIM_ASPIRANTS, type ArcKind } from "../engine/world-arcs";
import { adminListEvents, cancelPlayerEvent, createPlayerEvent, forceResolvePlayerEvent, PlayerEventError } from "./player-events";
import { tickWorldHappenings } from "./world-happenings";
import { postNews } from "./death-resolution";
import { startDispatch, DispatchError } from "./admiral-dispatch";
import { startCanonWar, runFront, warsSummary } from "./world-wars";
import { startCanonSeatEventNow, resolveCanonDuelNow, SeatError } from "./faction-seats";
import { grantItem, grantCatalogFruit, ITEM_IDS } from "./inventory";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";
import { invalidateWorldState } from "./world-state";

export class AdminToolError extends Error {}

async function findCharacterOrThrow(name: string) {
  const c = await prisma.character.findFirst({ where: { name: name.trim() } });
  if (!c) throw new AdminToolError(`No encuentro a ningún personaje llamado "${name}".`);
  return c;
}

const ONLINE_MS = 3 * 60_000;

/** Everything the owner's dashboard shows in one read. */
export async function getAdminOverview() {
  const now = Date.now();
  const [users, alive, dead, prisoners, online, reports, errors, events, crews, openArcs, recentNews] = await Promise.all([
    prisma.user.count(),
    prisma.character.count({ where: { status: "ALIVE" } }),
    prisma.character.count({ where: { status: "DEAD" } }),
    prisma.character.count({ where: { status: "IMPRISONED" } }),
    prisma.character.count({ where: { lastSeenAt: { gt: new Date(now - ONLINE_MS) } } }),
    prisma.oocReport.findMany({ where: { kind: "report" }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, context: true, message: true, createdAt: true } }),
    adminListEvents(),
    prisma.crew.count(),
    prisma.worldArc.count({ where: { status: { in: ["ACTIVE", "AWAITING_CONSENT"] } } }),
    prisma.newsItem.count({ where: { createdAt: { gt: new Date(now - 24 * 3600_000) } } }),
  ]);
  const names = new Map((await prisma.character.findMany({ where: { id: { in: reports.map((r) => r.characterId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  return {
    stats: { users, alive, dead, prisoners, online, crews, openArcs, newsLast24h: recentNews },
    reports: reports.map((r) => ({ id: r.id, author: names.get(r.characterId) ?? "(personaje borrado)", text: r.text, at: r.createdAt })),
    errors: errors.map((e) => ({ id: e.id, context: e.context, message: e.message.slice(0, 240), at: e.createdAt })),
    events,
    actors: (await prisma.worldActor.findMany({ select: { name: true, status: true, role: true, factionName: true }, orderBy: { name: "asc" } })).map((a) => ({ name: a.name, status: a.status, role: a.role, factionName: a.factionName })),
    characters: (await prisma.character.findMany({ where: { status: "ALIVE" }, select: { name: true, level: true }, orderBy: { name: "asc" }, take: 300 })).map((c) => ({ name: c.name, level: c.level })),
    islands: (await prisma.island.findMany({ select: { name: true }, orderBy: { name: "asc" } })).map((i) => i.name),
    itemIds: ITEM_IDS,
    // Only the duplicable catalog: grantCatalogFruit itself refuses singletons, so offering them here would just be a picker for a button that always fails.
    fruitNames: DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton).map((f) => f.name).sort((a, b) => a.localeCompare(b)),
  };
}

export async function dismissReport(id: string) {
  const n = await prisma.oocReport.deleteMany({ where: { id, kind: "report" } });
  if (n.count === 0) throw new AdminToolError("Ese reporte ya no existe.");
}

/** An official announcement straight into the news. Plain text from the owner, no AI in between. */
export async function publishAnnouncement(headline: string, body: string) {
  const h = headline.trim();
  const b = body.trim();
  if (h.length < 4 || h.length > 140) throw new AdminToolError("El titular debe tener entre 4 y 140 caracteres.");
  if (b.length < 10 || b.length > 3000) throw new AdminToolError("El texto debe tener entre 10 y 3000 caracteres.");
  await postNews(h, b, "Anuncios", undefined, "major", { locationName: "Todo el mundo" });
}

/** The owner proposes an idea (or just asks for one): the AI writes it up and it goes out as a world happening right now. */
export async function proposeHappening(idea: string | null, islandName: string | null) {
  if (islandName && !(await prisma.island.findUnique({ where: { name: islandName }, select: { id: true } }))) throw new AdminToolError("Esa isla no existe.");
  const ok = await tickWorldHappenings(new Date(), { force: true, idea: idea?.trim() || null, islandName });
  if (!ok) throw new AdminToolError("Ahora mismo se está generando otro suceso; espera unos segundos e inténtalo de nuevo.");
}

export async function adminCreateEvent(p: { idea?: string | null; islandName?: string | null; maxLevel?: number; withFruit?: boolean | null }) {
  try {
    return await createPlayerEvent({ ...p, createdBy: "admin" });
  } catch (e) {
    if (e instanceof PlayerEventError) throw new AdminToolError(e.message);
    throw e;
  }
}

export async function adminEventOp(op: "cancel" | "force", eventId: string) {
  try {
    if (op === "cancel") await cancelPlayerEvent(eventId);
    else await forceResolvePlayerEvent(eventId);
  } catch (e) {
    if (e instanceof PlayerEventError) throw new AdminToolError(e.message);
    throw e;
  }
}

/** The owner starts a world event (death/capture arc) between two named canon actors. The verdict is still the owner's at the end. */
export async function startArcManual(targetName: string, aggressorName: string, kind: ArcKind) {
  if (await prisma.worldArc.findFirst({ where: { status: { in: ["ACTIVE", "AWAITING_CONSENT"] } }, select: { id: true } })) throw new AdminToolError("Ya hay un evento mundial abierto: termina o cancela ese primero.");
  const [target, aggressor] = await Promise.all([prisma.worldActor.findFirst({ where: { name: targetName.trim() } }), prisma.worldActor.findFirst({ where: { name: aggressorName.trim() } })]);
  if (!target || !aggressor) throw new AdminToolError("No encuentro a uno de los dos personajes: escribe el nombre exacto del códice.");
  if (target.id === aggressor.id) throw new AdminToolError("El objetivo y el agresor no pueden ser el mismo personaje.");
  if (kind === "reclaim") {
    if (!RECLAIM_ASPIRANTS.includes(aggressor.name) || aggressor.status !== "DEFEATED") throw new AdminToolError("Solo un antiguo Yonko derrotado (Kaido, Big Mom) puede intentar recuperar el título.");
    if (target.role !== "YONKO" || target.status !== "ACTIVE") throw new AdminToolError(`${target.name} no es un Yonko en activo.`);
  } else
  for (const a of [target, aggressor]) {
    if (!arcEligible({ id: a.id, name: a.name, role: a.role, status: a.status, factionType: a.factionType, powerLevel: a.powerLevel })) throw new AdminToolError(`${a.name} no puede protagonizar un evento (no está activo o es un personaje protegido).`);
  }
  await prisma.worldArc.create({
    data: { kind, title: arcTitle(kind, target.name, aggressor.name), targetActorId: target.id, targetName: target.name, aggressorId: aggressor.id, aggressorName: aggressor.name, totalStages: ARC_TOTAL_STAGES, nextBeatAt: new Date() },
  });
}

/** The owner launches an admiral dispatch now: pick the admiral and the island from the lists; protections still apply. */
export async function adminStartDispatch(admiralName: string | null, islandName: string | null, minutes: number | null) {
  const island = islandName ? await prisma.island.findUnique({ where: { name: islandName }, select: { id: true } }) : null;
  if (islandName && !island) throw new AdminToolError("Esa isla no existe.");
  try {
    const d = await startDispatch({ admiralName: admiralName || undefined, islandId: island?.id, minutes: minutes ?? undefined, manual: true });
    if (!d) throw new AdminToolError("No se pudo enviar al almirante.");
    return d;
  } catch (e) {
    if (e instanceof DispatchError) throw new AdminToolError(e.message);
    throw e;
  }
}

// ---- Wars (Revolution/Justice/Emperor/Marine, engine/world-wars.ts) ----

/** Every war worth showing on the dashboard: active canon/player wars plus the last few ended ones. */
export async function adminListWars() {
  const wars = await prisma.war.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
  return wars.map((w) => ({
    id: w.id, kind: w.kind, status: w.status, attackerName: w.attackerName, defenderName: w.defenderName,
    attackerKind: w.attackerKind, defenderKind: w.defenderKind, attackerScore: w.attackerScore, defenderScore: w.defenderScore,
    nextFrontAt: w.nextFrontAt, startedAt: w.startedAt, outcome: w.outcome,
  }));
}

export async function adminStartCanonWar() {
  const w = await startCanonWar();
  if (!w) throw new AdminToolError("Ninguna guerra canon puede empezar ahora mismo (ya hay una activa o no hay bando disponible).");
  return { id: w.id, kind: w.kind, attackerName: w.attackerName, defenderName: w.defenderName };
}

/** Runs one front of a war right now, ignoring its normal 12h cadence. */
export async function adminRunWarFront(warId: string) {
  const line = await runFront(warId, new Date());
  if (!line) throw new AdminToolError("Esa guerra no existe, ya terminó o no tiene bandos con fuerzas disponibles.");
  return line;
}

/** Force-ends a war as a stalemate — an escape hatch if one gets stuck, not part of the normal flow. */
export async function adminEndWar(warId: string) {
  const w = await prisma.war.findUnique({ where: { id: warId } });
  if (!w || w.status !== "ACTIVE") throw new AdminToolError("Esa guerra no existe o ya terminó.");
  await prisma.war.update({ where: { id: warId }, data: { status: "ENDED", outcome: "stalemate", endedAt: new Date() } });
  await postNews("Alto el fuego", `${w.attackerName} y ${w.defenderName} detienen las hostilidades: la guerra termina en tablas, por ahora.`, "Guerra", undefined, "major");
  invalidateWorldState();
}

export async function adminWarsSummary() {
  return warsSummary();
}

// ---- Seats of command (engine/faction-seats.ts) ----

export async function adminListSeatChallenges() {
  const rows = await prisma.seatChallenge.findMany({ where: { status: { in: ["PENDING", "FIGHTING", "ANNOUNCED"] } }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map((c) => ({ id: c.id, seat: c.seat, status: c.status, challengerName: c.challengerName, defenderName: c.defenderName, expiresAt: c.expiresAt, resolveAt: c.resolveAt }));
}

export async function adminStartSeatEvent() {
  await startCanonSeatEventNow();
}

export async function adminResolveSeatDuel(challengeId: string) {
  try {
    await resolveCanonDuelNow(challengeId);
  } catch (e) {
    if (e instanceof SeatError) throw new AdminToolError(e.message);
    throw e;
  }
}

// ---- Direct player adjustments (owner-only escape hatches for testing/support) ----

const ADJUSTABLE = ["level", "berries", "bounty", "notoriety", "hp", "ancientScript", "attributePoints"] as const;
export type AdjustableField = (typeof ADJUSTABLE)[number];
export const ADJUSTABLE_FIELDS = ADJUSTABLE;

export async function adminAdjustCharacter(name: string, field: AdjustableField, value: number) {
  const c = await findCharacterOrThrow(name);
  if (!Number.isFinite(value)) throw new AdminToolError("Valor inválido.");
  const v = Math.round(value);
  if (field === "hp") {
    const clamped = Math.max(0, Math.min(c.maxHp, v));
    await prisma.character.update({ where: { id: c.id }, data: { hp: clamped } });
    return `${c.name}: vida ajustada a ${clamped}/${c.maxHp}.`;
  }
  if (v < 0) throw new AdminToolError("Ese valor no puede ser negativo.");
  await prisma.character.update({ where: { id: c.id }, data: { [field]: v } });
  return `${c.name}: ${field} ajustado a ${v}.`;
}

export async function adminTeleport(name: string, islandName: string) {
  const c = await findCharacterOrThrow(name);
  const island = await prisma.island.findUnique({ where: { name: islandName.trim() } });
  if (!island) throw new AdminToolError(`No existe la isla "${islandName}".`);
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: island.id, voyageToIslandId: null, voyageFromIslandId: null, voyageArrivesAt: null, voyageAmbushJson: null } });
  return `${c.name} aparece en ${island.name}.`;
}

export async function adminHeal(name: string) {
  const c = await findCharacterOrThrow(name);
  await prisma.character.update({ where: { id: c.id }, data: { hp: c.maxHp, stamina: 100 } });
  return `${c.name} recupera toda su vida y aguante.`;
}

export async function adminReleasePrisoner(name: string) {
  const c = await findCharacterOrThrow(name);
  const jail = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
  if (!jail || jail.releasedAt) throw new AdminToolError(`${c.name} no está preso.`);
  await prisma.$transaction([
    prisma.imprisonment.update({ where: { characterId: c.id }, data: { releasedAt: new Date() } }),
    prisma.character.update({ where: { id: c.id }, data: { status: CharacterStatus.ALIVE } }),
  ]);
  return `${c.name} queda libre.`;
}

export async function adminSetIslandControl(islandName: string, control: string | null) {
  const island = await prisma.island.findUnique({ where: { name: islandName.trim() } });
  if (!island) throw new AdminToolError(`No existe la isla "${islandName}".`);
  await prisma.island.update({ where: { id: island.id }, data: { factionControl: control?.trim() || null } });
  invalidateWorldState();
  return `${island.name} ahora la controla: ${control?.trim() || "nadie"}.`;
}

export async function adminGiveItem(name: string, itemId: string) {
  const c = await findCharacterOrThrow(name);
  if (!ITEM_IDS.includes(itemId)) throw new AdminToolError("Ese objeto no existe en el catálogo.");
  const line = await grantItem(c.id, itemId);
  if (!line) throw new AdminToolError("No se pudo entregar el objeto (mochila llena o id inválido).");
  return `${c.name}: ${line}`;
}

export async function adminGiveFruit(name: string, fruitName: string) {
  const c = await findCharacterOrThrow(name);
  const id = await grantCatalogFruit(c.id, fruitName.trim());
  if (!id) throw new AdminToolError(`No encuentro la fruta "${fruitName}" en el catálogo, o ${c.name} ya no tiene sitio en la mochila.`);
  return `${c.name} recibe la fruta ${fruitName}.`;
}
