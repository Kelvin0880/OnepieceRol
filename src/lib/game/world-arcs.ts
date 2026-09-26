import { prisma } from "../db";
import { varietyRng } from "../engine/rng";
import {
  ARC_TOTAL_STAGES,
  ArcKind,
  ArcOutcome,
  appendContext,
  arcDue,
  arcTitle,
  chapterAt,
  chapterLocation,
  fillBrief,
  nextBeatTime,
  outcomeActorStatus,
  pickArcCast,
  RECLAIM_ASPIRANTS,
  narrationKind,
  pickReclaimCast,
  reclaimAspirantWins,
  shouldStartArc,
  verdictOutcome,
} from "../engine/world-arcs";
import { MovableActor, PresenceActor, describePresence, pickMoves, seaLabel, whereLabel } from "../engine/actor-movement";
import { narrateWorldEvent } from "../ai/narrate";
import { judgeMatch } from "../ai/judge";
import { Contribution, InterventionSide, addContribution, interventionBlockReason, interventionMinLevel, interventionTilt, isInterventionSide, vanguardFor } from "../engine/arc-intervention";
import { startJointFight, freePartyMemberIds, JointFightError } from "./joint-fight";
import { postNews } from "./death-resolution";
import { invalidateWorldState } from "./world-state";
import { actorPrisonCell } from "../engine/world-state";
import { recentHappeningsFor } from "./world-happenings";

const OPEN_STATUSES = ["ACTIVE", "AWAITING_CONSENT"];
const inFlight = new Set<string>();
const DAY_MS = 24 * 60 * 60 * 1000;

export class WorldArcError extends Error {}

interface IslandInfo {
  id: string;
  name: string;
  neighbors: string[];
}

async function loadIslands(): Promise<Map<string, IslandInfo>> {
  const rows = await prisma.island.findMany({ select: { id: true, name: true, connections: true } });
  return new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, neighbors: JSON.parse(r.connections) as string[] }]));
}

/** Stable pick from a list so the same arc always chooses the same neighbouring places. */
function pickStable<T>(list: T[], seed: string): T | null {
  if (list.length === 0) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

// ---------------------------------------------------------------- movement

/** Every canon actor keeps a place in the world; a few move each tick. Actors caught in an arc stay where the story put them. */
export async function moveActorsTick(): Promise<void> {
  const [actors, openArcs, islands] = await Promise.all([prisma.worldActor.findMany({ where: { status: "ACTIVE" } }), prisma.worldArc.findMany({ where: { status: { in: OPEN_STATUSES } } }), loadIslands()]);
  const pinnedIds = new Set(openArcs.flatMap((a) => [a.targetActorId, a.aggressorId].filter(Boolean) as string[]));
  const now = new Date();
  // Whoever was sailing on the last tick arrives now.
  for (const a of actors) {
    if (a.locationKind === "sea" && a.seaToIslandId && !pinnedIds.has(a.id) && now.getTime() - (a.locationUpdatedAt?.getTime() ?? 0) > 15 * 60 * 1000) {
      await prisma.worldActor.update({ where: { id: a.id }, data: { locationKind: "island", currentIslandId: a.seaToIslandId, seaFromIslandId: null, seaToIslandId: null, locationUpdatedAt: now } });
    }
  }
  const fresh = await prisma.worldActor.findMany({ where: { status: "ACTIVE" } });
  const movable: MovableActor[] = fresh.map((a) => ({
    id: a.id, name: a.name, factionType: a.factionType, role: a.role, status: a.status, locationKind: a.locationKind,
    currentIslandId: a.currentIslandId, homeIslandId: a.homeIslandId, pinned: pinnedIds.has(a.id) || a.factionName === "Impel Down" || (a.busyUntil !== null && a.busyUntil > now),
  }));
  const moves = pickMoves(varietyRng(`moves:${Math.floor(Date.now() / 60_000)}`), movable, (id) => islands.get(id)?.neighbors ?? []);
  for (const m of moves) {
    const from = fresh.find((a) => a.id === m.actorId)?.currentIslandId ?? null;
    await prisma.worldActor.update({
      where: { id: m.actorId },
      data:
        m.viaSea && from
          ? { locationKind: "sea", currentIslandId: null, seaFromIslandId: from, seaToIslandId: m.toIslandId, locationHidden: m.hidden, locationUpdatedAt: now }
          : { locationKind: "island", currentIslandId: m.toIslandId, seaFromIslandId: null, seaToIslandId: null, locationHidden: m.hidden, locationUpdatedAt: now },
    });
  }
}

export async function placeName(islandId: string | null | undefined): Promise<string | null> {
  if (!islandId) return null;
  return (await prisma.island.findUnique({ where: { id: islandId }, select: { name: true } }))?.name ?? null;
}

/** Where a news item about this actor takes place: the real island, or "Ubicación desconocida" for someone moving in secret. */
export async function actorLocation(actor: { currentIslandId: string | null; locationHidden: boolean; locationKind?: string; seaFromIslandId?: string | null; seaToIslandId?: string | null }): Promise<{ islandId: string | null; name: string; kind: "island" | "sea" | "unknown" }> {
  const [islandName, fromName, toName] = await Promise.all([placeName(actor.currentIslandId), placeName(actor.seaFromIslandId), placeName(actor.seaToIslandId)]);
  const where = whereLabel({ hidden: actor.locationHidden, kind: actor.locationKind, islandName, seaFromName: fromName, seaToName: toName });
  return { islandId: where.kind === "island" ? actor.currentIslandId : null, name: where.name, kind: where.kind };
}

// ---------------------------------------------------------------- the living map for the narrator

const presenceCache = new Map<string, { at: number; text: string }>();
const PRESENCE_TTL_MS = 60_000;

/** "Who is where" around an island, plus running world events: injected into every narrator prompt. */
export async function worldPresenceFor(islandId: string): Promise<string> {
  const cached = presenceCache.get(islandId);
  if (cached && Date.now() - cached.at < PRESENCE_TTL_MS) return cached.text;
  const islands = await loadIslands();
  const here = islands.get(islandId);
  if (!here) return "";
  const nearIds = here.neighbors;
  const [hereActors, nearActors, arcs] = await Promise.all([
    prisma.worldActor.findMany({ where: { status: "ACTIVE", currentIslandId: islandId }, orderBy: { powerLevel: "desc" }, take: 8 }),
    prisma.worldActor.findMany({ where: { status: "ACTIVE", currentIslandId: { in: nearIds }, locationHidden: false }, orderBy: { powerLevel: "desc" }, take: 6 }),
    prisma.worldArc.findMany({ where: { status: { in: OPEN_STATUSES } } }),
  ]);
  const happenings = await recentHappeningsFor(islandId);
  const toPresence = (a: (typeof hereActors)[number]): PresenceActor => ({ name: a.name, role: a.role, factionName: a.factionName, rankLabel: a.rankLabel, hidden: a.locationHidden });
  const text = describePresence({
    islandName: here.name,
    here: hereActors.map(toPresence),
    nearby: nearActors.map((a) => ({ name: a.name, islandName: islands.get(a.currentIslandId ?? "")?.name ?? "?", hidden: a.locationHidden })),
    worldEvents: [...arcs.map((a) => `${a.title} (capítulo ${Math.min(a.stage, a.totalStages)}/${a.totalStages}${a.status === "AWAITING_CONSENT" ? ", desenlace en suspenso" : ""})`), ...happenings.map((h) => `Suceso reciente en esta isla: ${h}`)],
  });
  presenceCache.set(islandId, { at: Date.now(), text });
  return text;
}

// ---------------------------------------------------------------- arcs

function fallbackChapter(label: string, brief: string, place: string, target: string, aggressor: string | null): { headline: string; body: string } {
  return {
    headline: `${label}: ${target} en el punto de mira`,
    body: `En ${place}: ${fillBrief(brief, target, aggressor)}`,
  };
}

async function runArcBeat(arcId: string): Promise<void> {
  const arc = await prisma.worldArc.findUnique({ where: { id: arcId } });
  if (!arc || arc.status !== "ACTIVE" || arc.stage >= arc.totalStages) return;
  // Claim the chapter: only one request may publish it, however many trigger the tick at once.
  const claimed = await prisma.worldArc.updateMany({ where: { id: arc.id, stage: arc.stage, status: "ACTIVE" }, data: { stage: arc.stage + 1 } });
  if (claimed.count === 0) return;
  const stage = arc.stage + 1;

  const [target, aggressor, islands] = await Promise.all([
    prisma.worldActor.findUnique({ where: { id: arc.targetActorId } }),
    arc.aggressorId ? prisma.worldActor.findUnique({ where: { id: arc.aggressorId } }) : null,
    loadIslands(),
  ]);
  if (!target) return;

  const targetIsland = target.currentIslandId ?? target.homeIslandId;
  const aggressorIsland = aggressor?.currentIslandId ?? aggressor?.homeIslandId ?? null;
  const nearTarget = pickStable(islands.get(targetIsland ?? "")?.neighbors ?? [], `${arc.id}:near`);
  const siege = pickStable((islands.get(nearTarget ?? "")?.neighbors ?? []).filter((n) => n !== targetIsland), `${arc.id}:siege`) ?? nearTarget;
  // The escalation is a running fight on the water between the target's island and the next one: never pinned to a place it did not happen.
  const atSea = stage === 4 && !!targetIsland && !!nearTarget;
  const locId = atSea ? null : chapterLocation(stage, { target: targetIsland, aggressor: aggressorIsland, nearTarget, siege });
  const place = atSea ? seaLabel(islands.get(targetIsland!)?.name, islands.get(nearTarget!)?.name) : locId ? islands.get(locId)?.name ?? "Ubicación desconocida" : "Ubicación desconocida";

  const chapter = chapterAt(stage);
  const context: string[] = JSON.parse(arc.contextJson);
  const brief = fillBrief(chapter.brief, arc.targetName, arc.aggressorName);
  const narrated = await narrateWorldEvent(
    { kind: narrationKind(arc.kind as ArcKind), reclaim: arc.kind === "reclaim", stage, totalStages: arc.totalStages, chapterLabel: chapter.label, brief, targetName: arc.targetName, aggressorName: arc.aggressorName, locationName: place, storySoFar: context },
    fallbackChapter(chapter.label, chapter.brief, place, arc.targetName, arc.aggressorName),
    { arcId: arc.id, stage: String(stage) }
  );

  const now = new Date();
  const isLast = stage >= arc.totalStages;
  await prisma.$transaction([
    prisma.newsItem.create({
      data: { headline: narrated.headline, body: narrated.body, category: "Eventos mundiales", severity: stage >= 3 ? "major" : "normal", worldActorId: target.id, locationName: place, islandId: locId, arcId: arc.id, arcStage: stage },
    }),
    prisma.worldArc.update({
      where: { id: arc.id },
      data: {
        contextJson: JSON.stringify(appendContext(context, `Capítulo ${stage} (${chapter.label}, ${place}): ${narrated.headline}`)),
        nextBeatAt: nextBeatTime(now, varietyRng(`beat:${arcId}:${stage}`)),
        ...(isLast ? { status: "AWAITING_CONSENT", consent: "PENDING" } : {}),
      },
    }),
    // The story moves the people in it, and keeps them out of unrelated ambient news meanwhile.
    prisma.worldActor.update({ where: { id: target.id }, data: { ...(atSea ? { locationKind: "sea", currentIslandId: null, seaFromIslandId: targetIsland, seaToIslandId: nearTarget } : { locationKind: "island", currentIslandId: locId ?? target.currentIslandId, seaFromIslandId: null, seaToIslandId: null }), locationHidden: false, locationUpdatedAt: now, currentFocus: `En pleno suceso: ${arc.title}`, busyUntil: new Date(now.getTime() + (isLast ? 14 * DAY_MS : 12 * 60 * 60 * 1000)) } }),
    ...(aggressor && stage >= 3
      ? [prisma.worldActor.update({ where: { id: aggressor.id }, data: { ...(atSea ? { locationKind: "sea", currentIslandId: null, seaFromIslandId: targetIsland, seaToIslandId: nearTarget } : { locationKind: "island", currentIslandId: locId ?? aggressor.currentIslandId, seaFromIslandId: null, seaToIslandId: null }), locationHidden: false, locationUpdatedAt: now, currentFocus: `En pleno suceso: ${arc.title}`, busyUntil: new Date(now.getTime() + (isLast ? 14 * DAY_MS : 12 * 60 * 60 * 1000)) } })]
      : []),
    prisma.worldClock.update({ where: { id: 1 }, data: { heat: { increment: 3 } } }),
  ]);
  presenceCache.clear();
  if (isLast && arc.kind === "reclaim") {
    await resolveReclaim(arc.id);
  } else if (isLast) {
    const fresh = await prisma.worldArc.findUnique({ where: { id: arc.id } });
    const contribs = fresh ? (JSON.parse(fresh.contributionsJson) as Contribution[]) : [];
    if (fresh && interventionTilt(contribs) === "saved") {
      await prisma.worldArc.updateMany({ where: { id: arc.id, status: "AWAITING_CONSENT" }, data: { consent: "DENIED" } });
      await finalizeArc(arc.id, "survived", "aventureros", [...new Set(contribs.filter((c) => c.side !== "assist").map((c) => c.name))]);
    }
  }
}

/**
 * Lazily advances the running world event, or (rarely) starts one. Fire-and-forget from the world tick:
 * the player whose request happens to trigger it never waits on the AI.
 */
export async function tickWorldArcs(now = new Date()): Promise<void> {
  if (inFlight.has("tick")) return;
  inFlight.add("tick");
  try {
    const open = await prisma.worldArc.findFirst({ where: { status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "desc" } });
    if (open) {
      if (arcDue(open, now)) await runArcBeat(open.id);
      return;
    }
    const [clock, lastResolved, actors] = await Promise.all([
      prisma.worldClock.findUnique({ where: { id: 1 } }),
      prisma.worldArc.findFirst({ where: { status: "RESOLVED" }, orderBy: { updatedAt: "desc" } }),
      prisma.worldActor.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, role: true, status: true, factionType: true, powerLevel: true } }),
    ]);
    const rng = varietyRng(`arc:${Math.floor(Date.now() / 60_000)}`);
    if (!shouldStartArc(rng, { hasOpenArc: false, lastResolvedAt: lastResolved?.updatedAt ?? null, heat: clock?.heat ?? 0, now })) return;
    const reclaimPool = await prisma.worldActor.findMany({ where: { OR: [{ status: "DEFEATED", name: { in: RECLAIM_ASPIRANTS } }, { status: "ACTIVE", role: "YONKO" }] }, select: { id: true, name: true, role: true, status: true, factionType: true, powerLevel: true } });
    const cast = (rng() < 0.4 ? pickReclaimCast(rng, reclaimPool) : null) ?? pickArcCast(rng, actors);
    if (!cast) return;
    await prisma.worldArc.create({
      data: {
        kind: cast.kind,
        title: arcTitle(cast.kind, cast.target.name, cast.aggressor.name),
        targetActorId: cast.target.id,
        targetName: cast.target.name,
        aggressorId: cast.aggressor.id,
        aggressorName: cast.aggressor.name,
        totalStages: ARC_TOTAL_STAGES,
        nextBeatAt: now,
      },
    });
  } finally {
    inFlight.delete("tick");
  }
}

/** The game owner's verdict. Only here can a canon character die or be captured; a denial always means they survive. */
export async function decideArc(arcId: string, approve: boolean, decidedBy: string, choice?: "capture" | "death" | "survived"): Promise<{ outcome: ArcOutcome; headline: string }> {
  const arc = await prisma.worldArc.findUnique({ where: { id: arcId } });
  if (!arc) throw new WorldArcError("Ese evento no existe.");
  if (arc.status !== "AWAITING_CONSENT" || arc.consent !== "PENDING") throw new WorldArcError("Este evento no está esperando una decisión.");
  const claimed = await prisma.worldArc.updateMany({ where: { id: arc.id, status: "AWAITING_CONSENT", consent: "PENDING" }, data: { consent: approve ? "APPROVED" : "DENIED" } });
  if (claimed.count === 0) throw new WorldArcError("Otra decisión se te adelantó.");
  const outcome = arc.kind === "reclaim_lost" && choice ? choice : verdictOutcome(arc.kind as ArcKind, approve);
  return finalizeArc(arc.id, outcome, decidedBy);
}

/** Publishes the ending and applies it. Shared by the owner's verdict and by adventurers saving the target on their own. */
async function finalizeArc(arcId: string, outcome: ArcOutcome, decidedBy: string, savedBy: string[] = []): Promise<{ outcome: ArcOutcome; headline: string }> {
  const arc = await prisma.worldArc.findUniqueOrThrow({ where: { id: arcId } });
  const [target, islands] = await Promise.all([prisma.worldActor.findUnique({ where: { id: arc.targetActorId } }), loadIslands()]);
  const context: string[] = JSON.parse(arc.contextJson);
  if (savedBy.length) context.push(`Aventureros intervinieron para salvarlo: ${savedBy.join(", ")}.`);
  const lastNews = await prisma.newsItem.findFirst({ where: { arcId: arc.id }, orderBy: { createdAt: "desc" }, select: { islandId: true, locationName: true } });
  const placeId = lastNews?.islandId ?? target?.currentIslandId ?? null;
  const place = lastNews?.locationName ?? (placeId ? islands.get(placeId)?.name ?? "Ubicación desconocida" : "Ubicación desconocida");

  const rescuers = savedBy.length ? ` Gracias a ${savedBy.join(", ")}.` : "";
  const fallbackBody =
    outcome === "death"
      ? `${arc.targetName} ha caído en ${place}. El mundo entero conoce ya el final de esta historia.`
      : outcome === "capture"
      ? `${arc.targetName} ha sido capturado en ${place}. Su destino queda en manos de sus captores.`
      : `${arc.targetName} ha escapado de ${place} contra todo pronóstico.${rescuers} ${arc.aggressorName ?? "Sus perseguidores"} vuelve(n) con las manos vacías.`;
  const narrated = await narrateWorldEvent(
    { kind: narrationKind(arc.kind as ArcKind), reclaim: arc.kind === "reclaim" || arc.kind === "reclaim_lost", stage: arc.totalStages + 1, totalStages: arc.totalStages, chapterLabel: "Desenlace", brief: "", targetName: arc.targetName, aggressorName: arc.aggressorName, locationName: place, storySoFar: context, verdict: outcome },
    { headline: outcome === "survived" ? `${arc.targetName} escapa del cerco` : outcome === "death" ? `Muere ${arc.targetName}` : `Capturan a ${arc.targetName}`, body: fallbackBody },
    { arcId: arc.id, verdict: outcome }
  );

  const now = new Date();
  const impel = [...islands.values()].find((i) => i.name === "Impel Down");
  await prisma.$transaction([
    prisma.newsItem.create({
      data: { headline: narrated.headline, body: narrated.body, category: "Eventos mundiales", severity: "major", worldActorId: arc.targetActorId, locationName: place, islandId: placeId, arcId: arc.id, arcStage: arc.totalStages + 1 },
    }),
    prisma.worldArc.update({
      where: { id: arc.id },
      data: { status: "RESOLVED", outcome, consent: arc.consent === "PENDING" ? "DENIED" : arc.consent, decidedBy, decidedAt: now, contextJson: JSON.stringify(appendContext(context, `Desenlace: ${narrated.headline}`)) },
    }),
    ...(target
      ? [
          prisma.worldActor.update({
            where: { id: target.id },
            data: {
              status: outcomeActorStatus(outcome, target.status),
              currentFocus: outcome === "survived" ? "En fuga tras un cerco fallido" : outcome === "capture" ? "Prisionero" : null,
              busyUntil: outcome === "survived" ? new Date(now.getTime() + 12 * 60 * 60 * 1000) : null,
              ...(outcome === "capture" && impel ? { currentIslandId: impel.id, locationHidden: false, locationKind: "island", seaFromIslandId: null, seaToIslandId: null, prisonLevel: actorPrisonCell(target.canonBounty != null ? Number(target.canonBounty) : null, target.powerLevel), capturedAt: now } : {}),
              ...(outcome === "survived" ? { locationHidden: true } : {}),
              locationUpdatedAt: now,
            },
          }),
        ]
      : []),
    ...(arc.aggressorId ? [prisma.worldActor.update({ where: { id: arc.aggressorId }, data: { busyUntil: null, currentFocus: null } })] : []),
    prisma.worldClock.update({ where: { id: 1 }, data: { heat: { increment: outcome === "survived" ? 5 : 15 } } }),
  ]);
  presenceCache.clear();
  invalidateWorldState();
  return { outcome, headline: narrated.headline };
}

// ---------------------------------------------------------------- reclaiming the Yonko throne

function fighterOf(a: { name: string; powerLevel: number; abilitiesJson: string | null }) {
  const abilities = a.abilitiesJson ? (JSON.parse(a.abilitiesJson) as string[]).slice(0, 6).join("; ") : "";
  return { name: a.name, level: a.powerLevel, atk: a.powerLevel * 10, def: a.powerLevel * 9, kit: abilities || undefined };
}

/**
 * The throne fight. Adventurers who defended the target win it for them; otherwise the judge weighs both sides.
 * A win hands over the title and the territory (the loser lives, dethroned). A loss never decides the aspirant's fate:
 * the arc turns into "reclaim_lost" and waits for the owner (capture, death or mercy).
 */
async function resolveReclaim(arcId: string): Promise<void> {
  const arc = await prisma.worldArc.findUnique({ where: { id: arcId } });
  if (!arc || arc.kind !== "reclaim" || !arc.aggressorId) return;
  const [target, aspirant] = await Promise.all([prisma.worldActor.findUnique({ where: { id: arc.targetActorId } }), prisma.worldActor.findUnique({ where: { id: arc.aggressorId } })]);
  if (!target || !aspirant) return;
  const contribs = JSON.parse(arc.contributionsJson) as Contribution[];
  const tilt = interventionTilt(contribs);
  const verdict = tilt === "saved" ? null : await judgeMatch(fighterOf(aspirant), fighterOf(target), `Duelo por el trono de Yonko: ${aspirant.name} (derrotado antes) intenta arrebatárselo a ${target.name}.`);
  const aspirantWins = reclaimAspirantWins(tilt, verdict?.winner === "a");
  const context: string[] = JSON.parse(arc.contextJson);
  const islands = await loadIslands();
  const now = new Date();

  if (!aspirantWins) {
    const helpers = [...new Set(contribs.filter((c) => c.side !== "assist").map((c) => c.name))];
    await prisma.$transaction([
      prisma.worldArc.update({
        where: { id: arc.id },
        data: { kind: "reclaim_lost", targetActorId: aspirant.id, targetName: aspirant.name, aggressorId: target.id, aggressorName: target.name, status: "AWAITING_CONSENT", consent: "PENDING", contextJson: JSON.stringify(appendContext(context, `${aspirant.name} fue derrotado en su asalto al trono de ${target.name}${helpers.length ? ` con ayuda de ${helpers.join(", ")}` : ""}.`)) },
      }),
      prisma.newsItem.create({
        data: { headline: `${aspirant.name} fracasa: ${target.name} conserva el trono`, body: `El intento de ${aspirant.name} de recuperar el título de Yonko terminó en derrota ante ${target.name}${helpers.length ? `, con la ayuda de ${helpers.join(", ")}` : ""}. Su destino está por decidirse.`, category: "Eventos mundiales", severity: "major", worldActorId: aspirant.id, locationName: islands.get(target.currentIslandId ?? "")?.name ?? "Ubicación desconocida", arcId: arc.id, arcStage: arc.totalStages + 1 },
      }),
    ]);
    presenceCache.clear();
    invalidateWorldState();
    return;
  }

  const territories = await prisma.territory.findMany({ where: { OR: [{ ownerActorId: target.id }, { homeActorId: target.id }] } });
  const place = islands.get(target.currentIslandId ?? target.homeIslandId ?? "")?.name ?? "Ubicación desconocida";
  const narrated = await narrateWorldEvent(
    { kind: "capture", reclaim: true, stage: arc.totalStages + 1, totalStages: arc.totalStages, chapterLabel: "Desenlace", brief: "", targetName: target.name, aggressorName: aspirant.name, locationName: place, storySoFar: context, verdict: "reclaimed" },
    { headline: `${aspirant.name} recupera el trono de Yonko`, body: `${aspirant.name} derrotó a ${target.name} en ${place} y se quedó con su territorio. ${target.name} huye, sin el título.` },
    { arcId: arc.id, verdict: "reclaimed" }
  );
  await prisma.$transaction([
    prisma.newsItem.create({ data: { headline: narrated.headline, body: narrated.body, category: "Eventos mundiales", severity: "major", worldActorId: aspirant.id, locationName: place, islandId: target.currentIslandId ?? target.homeIslandId, arcId: arc.id, arcStage: arc.totalStages + 1 } }),
    prisma.worldArc.update({ where: { id: arc.id }, data: { status: "RESOLVED", outcome: "reclaimed", consent: "NONE", decidedBy: "juicio", decidedAt: now, contextJson: JSON.stringify(appendContext(context, `Desenlace: ${narrated.headline}`)) } }),
    prisma.worldActor.update({ where: { id: aspirant.id }, data: { status: "ACTIVE", role: "YONKO", rankLabel: "Yonko (recuperó el trono)", currentIslandId: target.currentIslandId ?? target.homeIslandId, homeIslandId: target.homeIslandId ?? aspirant.homeIslandId, locationKind: "island", seaFromIslandId: null, seaToIslandId: null, locationHidden: false, locationUpdatedAt: now, busyUntil: null, currentFocus: "Reina en el territorio que arrebató" } }),
    prisma.worldActor.update({ where: { id: target.id }, data: { role: "NOTABLE_PIRATE", rankLabel: "Ex-Yonko (destronado)", locationHidden: true, locationUpdatedAt: now, busyUntil: new Date(now.getTime() + 2 * DAY_MS), currentFocus: "Huye tras perder su trono" } }),
    ...territories.map((t) => prisma.territory.update({ where: { id: t.id }, data: { ownerActorId: aspirant.id, homeActorId: aspirant.id, ownerName: aspirant.name } })),
    prisma.worldClock.update({ where: { id: 1 }, data: { heat: { increment: 15 } } }),
  ]);
  presenceCache.clear();
  invalidateWorldState();
}

// ---------------------------------------------------------------- player intervention

async function currentArcLocation(arcId: string): Promise<{ islandId: string | null; name: string | null }> {
  const last = await prisma.newsItem.findFirst({ where: { arcId, arcStage: { not: null } }, orderBy: { createdAt: "desc" }, select: { islandId: true, locationName: true } });
  return { islandId: last?.islandId ?? null, name: last?.locationName ?? null };
}

export interface CharacterWorldEvent {
  arcId: string;
  title: string;
  stage: number;
  totalStages: number;
  locationName: string | null;
  minLevel: number;
  canIntervene: boolean;
  reason: string | null;
  target: string;
  aggressor: string | null;
  defenders: number;
  helpers: number;
}

/** The world event happening where this character stands, if any, and whether they may step into it. */
export async function getWorldEventForCharacter(characterId: string): Promise<CharacterWorldEvent | null> {
  const [ch, arc] = await Promise.all([
    prisma.character.findUnique({ where: { id: characterId }, select: { level: true, currentIslandId: true, status: true } }),
    prisma.worldArc.findFirst({ where: { status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!ch || !arc) return null;
  const where = await currentArcLocation(arc.id);
  if (!where.islandId || where.islandId !== ch.currentIslandId) return null;
  const [target, aggressor] = await Promise.all([prisma.worldActor.findUnique({ where: { id: arc.targetActorId } }), arc.aggressorId ? prisma.worldActor.findUnique({ where: { id: arc.aggressorId } }) : null]);
  const minLevel = interventionMinLevel(target?.powerLevel ?? 80, aggressor?.powerLevel ?? 80);
  const contribs = JSON.parse(arc.contributionsJson) as Contribution[];
  const reason =
    ch.status !== "ALIVE"
      ? "Tu personaje no puede actuar ahora."
      : interventionBlockReason({ arcStatus: arc.status, stage: arc.stage, totalStages: arc.totalStages, playerIslandId: ch.currentIslandId, arcIslandId: where.islandId, level: ch.level, minLevel, alreadyThisStage: contribs.some((c) => c.characterId === characterId && c.stage === arc.stage) });
  const tally = contribs.reduce((t, c) => ({ defend: t.defend + (c.side === "defend" ? 1 : c.side === "chaos" ? 0.5 : 0), assist: t.assist + (c.side === "assist" ? 1 : 0) }), { defend: 0, assist: 0 });
  return { arcId: arc.id, title: arc.title, stage: Math.min(arc.stage, arc.totalStages), totalStages: arc.totalStages, locationName: where.name, minLevel, canIntervene: !reason, reason, target: arc.targetName, aggressor: arc.aggressorName, defenders: tally.defend, helpers: tally.assist };
}

/** Steps into the event: opens a real group fight against the chosen vanguard, with the player's free crewmates. */
export async function interveneInArc(characterId: string, userId: string, arcId: string, sideRaw: unknown): Promise<{ log: string[] }> {
  if (!isInterventionSide(sideRaw)) throw new WorldArcError("Elige un bando: defender, apoyar al agresor o sembrar el caos.");
  const side: InterventionSide = sideRaw;
  const ch = await prisma.character.findUnique({ where: { id: characterId } });
  if (!ch || ch.userId !== userId) throw new WorldArcError("Personaje no encontrado.");
  const view = await getWorldEventForCharacter(characterId);
  if (!view || view.arcId !== arcId) throw new WorldArcError("No hay ningún evento mundial donde estás.");
  if (view.reason) throw new WorldArcError(view.reason);
  const arc = await prisma.worldArc.findUniqueOrThrow({ where: { id: arcId } });
  const [target, aggressor] = await Promise.all([prisma.worldActor.findUnique({ where: { id: arc.targetActorId } }), arc.aggressorId ? prisma.worldActor.findUnique({ where: { id: arc.aggressorId } }) : null]);
  const v = vanguardFor(side, { name: arc.targetName, power: target?.powerLevel ?? 80 }, { name: arc.aggressorName ?? "sus perseguidores", power: aggressor?.powerLevel ?? 80 }, arc.stage);
  const stakes =
    side === "defend"
      ? `Proteger a ${arc.targetName} de ${arc.aggressorName ?? "sus perseguidores"} en ${view.locationName}.`
      : side === "assist"
      ? `Ayudar a ${arc.aggressorName ?? "los perseguidores"} contra ${arc.targetName} en ${view.locationName}.`
      : `Lanzarse contra todos en ${view.locationName}: nadie tiene ventaja.`;
  try {
    const started = await startJointFight({
      kind: "arc",
      characterIds: await freePartyMemberIds(characterId),
      enemy: { name: v.name, hp: v.hp, atk: v.atk, def: v.def, spd: v.spd, isBoss: true, level: v.level, personality: "soldados disciplinados que luchan por su bando sin dudar" },
      rewards: { berries: 30_000 * arc.stage, xp: 70 * arc.stage, bounty: side === "assist" ? 0 : 2_000_000 * arc.stage, islandDanger: 9 },
      stakes,
      context: { arcId: arc.id, side, stage: arc.stage },
    });
    return { log: started.log.length ? started.log : [`${ch.name} se mete de lleno en el suceso: ${stakes}`] };
  } catch (err) {
    if (err instanceof JointFightError) throw new WorldArcError(err.message);
    throw err;
  }
}

/** Called when an intervention fight ends: winners score for their side; enough defenders save the target on the spot. */
export async function handleArcFightSettled(p: { contextJson: string; outcome: "victory" | "defeat" | null; humans: { characterId: string; status: string; name: string }[] }): Promise<string[]> {
  const ctx = JSON.parse(p.contextJson) as { arcId?: string; side?: InterventionSide; stage?: number };
  if (!ctx.arcId || !ctx.side || p.outcome !== "victory") return [];
  const arc = await prisma.worldArc.findUnique({ where: { id: ctx.arcId } });
  if (!arc || !OPEN_STATUSES.includes(arc.status)) return [];
  const winners = p.humans.filter((h) => h.status !== "DOWN");
  if (winners.length === 0) return [];

  let contribs = JSON.parse(arc.contributionsJson) as Contribution[];
  const levels = new Map((await prisma.character.findMany({ where: { id: { in: winners.map((w) => w.characterId) } }, select: { id: true, level: true } })).map((c) => [c.id, c.level]));
  for (const w of winners) contribs = addContribution(contribs, { characterId: w.characterId, name: w.name, side: ctx.side, stage: ctx.stage ?? arc.stage, level: levels.get(w.characterId) ?? 1 });
  await prisma.worldArc.update({ where: { id: arc.id }, data: { contributionsJson: JSON.stringify(contribs) } });

  const names = winners.map((w) => w.name).join(", ");
  const where = await currentArcLocation(arc.id);
  const sideText = ctx.side === "defend" ? `defienden a ${arc.targetName}` : ctx.side === "assist" ? `se alían con ${arc.aggressorName ?? "los perseguidores"} contra ${arc.targetName}` : "se lanzan contra los dos bandos";
  await postNews(`${names} intervienen en ${arc.title}`, `En pleno suceso, ${names} ${sideText} y salen victoriosos de la escaramuza.`, "Eventos mundiales", winners[0].characterId, "major", { locationName: where.name ?? undefined, islandId: where.islandId ?? undefined });
  const lines = [`Vuestra intervención inclina la balanza en «${arc.title}».`];

  // Enough defenders decide it without anyone's verdict — but only once the story has reached its climax.
  if (interventionTilt(contribs) === "saved" && arc.status === "AWAITING_CONSENT") {
    const savers = [...new Set(contribs.filter((c) => c.side !== "assist").map((c) => c.name))];
    await prisma.worldArc.updateMany({ where: { id: arc.id, status: "AWAITING_CONSENT" }, data: { consent: "DENIED" } });
    const done = await finalizeArc(arc.id, "survived", "aventureros", savers);
    lines.push(`¡${arc.targetName} se salva gracias a vosotros! «${done.headline}»`);
  } else if (interventionTilt(contribs) === "saved") {
    lines.push(`Los defensores ya son suficientes: si aguantan hasta el desenlace, ${arc.targetName} se salvará.`);
  }
  return lines;
}

// ---------------------------------------------------------------- feeds

export interface WorldEventView {
  id: string;
  title: string;
  status: string;
  stage: number;
  totalStages: number;
  outcome: string | null;
  createdAt: string;
  beats: { id: string; stage: number; headline: string; body: string; locationName: string | null; createdAt: string }[];
}

/** Public feed: what is happening and how it got there. The kind of ending (death/capture) is never revealed before the verdict. */
export async function getWorldEvents(limit = 5): Promise<WorldEventView[]> {
  const arcs = await prisma.worldArc.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  const news = await prisma.newsItem.findMany({ where: { arcId: { in: arcs.map((a) => a.id) } }, orderBy: { createdAt: "asc" } });
  return arcs.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    stage: Math.min(a.stage, a.totalStages),
    totalStages: a.totalStages,
    outcome: a.status === "RESOLVED" ? a.outcome : null,
    createdAt: a.createdAt.toISOString(),
    beats: news.filter((n) => n.arcId === a.id).map((n) => ({ id: n.id, stage: n.arcStage ?? 0, headline: n.headline, body: n.body, locationName: n.locationName, createdAt: n.createdAt.toISOString() })),
  }));
}

/** Owner-only: everything needed to decide, including what the arc would do if approved. */
export async function getArcsForAdmin() {
  const arcs = await prisma.worldArc.findMany({ where: { status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "desc" } });
  return arcs.map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    status: a.status,
    consent: a.consent,
    stage: a.stage,
    totalStages: a.totalStages,
    target: a.targetName,
    aggressor: a.aggressorName,
    nextBeatAt: a.nextBeatAt.toISOString(),
    story: JSON.parse(a.contextJson) as string[],
    interventions: JSON.parse(a.contributionsJson) as Contribution[],
    proposal: a.kind === "reclaim_lost" ? `${a.targetName} fracasó en su intento de recuperar el trono de Yonko${a.aggressorName ? ` ante ${a.aggressorName}` : ""} y está a merced de sus vencedores. ¿Qué decides: CAPTURA, MUERTE o que sobreviva?` : a.kind === "death" ? `¿Permites que ${a.targetName} MUERA${a.aggressorName ? ` a manos de ${a.aggressorName}` : ""}?` : `¿Permites que ${a.targetName} sea CAPTURADO${a.aggressorName ? ` por ${a.aggressorName}` : ""}?`,
  }));
}

/** Admin tool: make the next chapter due right now (used to review the story without waiting hours). */
export async function advanceArcNow(arcId: string): Promise<void> {
  await prisma.worldArc.updateMany({ where: { id: arcId, status: "ACTIVE" }, data: { nextBeatAt: new Date() } });
  await tickWorldArcs();
}

export async function cancelArc(arcId: string): Promise<void> {
  const arc = await prisma.worldArc.findUnique({ where: { id: arcId } });
  if (!arc || !OPEN_STATUSES.includes(arc.status)) throw new WorldArcError("Ese evento ya no está abierto.");
  await prisma.$transaction([
    prisma.worldArc.update({ where: { id: arc.id }, data: { status: "RESOLVED", outcome: "survived", consent: "DENIED", decidedAt: new Date() } }),
    prisma.worldActor.updateMany({ where: { id: { in: [arc.targetActorId, ...(arc.aggressorId ? [arc.aggressorId] : [])] } }, data: { busyUntil: null, currentFocus: null } }),
  ]);
}
