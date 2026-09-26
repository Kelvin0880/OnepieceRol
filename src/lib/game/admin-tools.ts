import { prisma } from "../db";
import { arcEligible, arcTitle, ARC_TOTAL_STAGES, RECLAIM_ASPIRANTS, type ArcKind } from "../engine/world-arcs";
import { adminListEvents, cancelPlayerEvent, createPlayerEvent, forceResolvePlayerEvent, PlayerEventError } from "./player-events";
import { tickWorldHappenings } from "./world-happenings";
import { postNews } from "./death-resolution";

export class AdminToolError extends Error {}

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
