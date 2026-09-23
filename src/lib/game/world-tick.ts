import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { runWorldTick } from "../engine/world";
import { narrateNews, narrateBountyDigest } from "../ai/narrate";

const TICK_INTERVAL_MS = 30 * 60 * 1000; // a new world beat roughly every 30 real minutes — the user found 5 too fast/noisy for a "living but calm" world
const DIGEST_INTERVAL_MS = 6 * 60 * 60 * 1000; // a couple of bounty roundups a day, deliberately much rarer than the ambient tick
const DIGEST_SAMPLE_SIZE = 5;

function formatBerries(n: bigint): string {
  return `${n.toLocaleString("es-ES")} berries`;
}

/**
 * Lazily advances the background world simulation. Called opportunistically
 * from player-facing routes instead of a real cron job, which keeps this
 * deployable on a single free-tier web service with no extra infra — the
 * first request after the interval elapses pays the (tiny) cost of a tick.
 *
 * Faction-aware + AI-narrated (2026-09-23 rewrite): runWorldTick now only
 * ever picks an actor whose factionType matches the template's
 * allowedFactionTypes (see engine/world.ts for why — this is the direct fix
 * for the "Kizaru recluta piratas" bug). Once a template+actor pair is
 * decided deterministically, narrateNews turns it into real prose — the
 * engine's own bodyVariants text becomes the fallback if that AI call fails,
 * never the primary content anymore.
 */
export async function tickWorldIfDue(): Promise<void> {
  const clock = await prisma.worldClock.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, heat: 10 },
  });

  const now = new Date();
  if (now.getTime() - clock.lastTickAt.getTime() < TICK_INTERVAL_MS) return;

  const [templates, actors] = await Promise.all([prisma.worldEventTemplate.findMany(), prisma.worldActor.findMany()]);

  const result = runWorldTick(
    liveRng(),
    now,
    clock.heat,
    templates.map((t) => {
      const parsed = JSON.parse(t.bodyJson) as { variants: string[]; busyHours?: [number, number]; heatDelta?: number };
      return {
        id: t.id,
        weight: t.weight,
        minHeat: t.minHeat,
        headline: t.headline,
        category: t.category,
        bodyVariants: parsed.variants,
        busyHours: parsed.busyHours,
        heatDelta: parsed.heatDelta ?? 0,
        allowedFactionTypes: t.allowedFactionTypes ? (JSON.parse(t.allowedFactionTypes) as string[]) : null,
        promptHint: t.promptHint,
      };
    }),
    actors.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      factionType: a.factionType,
      factionName: a.factionName,
      rankLabel: a.rankLabel,
      canonBounty: a.canonBounty != null ? a.canonBounty.toString() : null,
      personality: a.personality,
      busyUntil: a.busyUntil,
    }))
  );

  await prisma.worldClock.update({ where: { id: 1 }, data: { lastTickAt: now } });
  if (!result) return;

  const actor = result.involvedActorId ? actors.find((a) => a.id === result.involvedActorId) ?? null : null;
  const narrated = await narrateNews(
    {
      category: result.category,
      promptHint: result.promptHint,
      actorName: actor?.name,
      actorFactionName: actor?.factionName,
      actorRankLabel: actor?.rankLabel ?? undefined,
      actorPersonality: actor?.personality ?? undefined,
      actorCanonBounty: actor?.canonBounty != null ? formatBerries(actor.canonBounty) : undefined,
      heat: clock.heat,
    },
    { headline: result.headline, body: result.body },
    { category: result.category }
  );

  await prisma.$transaction([
    prisma.newsItem.create({
      data: {
        headline: narrated.headline,
        body: narrated.body,
        category: result.category,
        worldActorId: result.involvedActorId,
      },
    }),
    prisma.worldClock.update({ where: { id: 1 }, data: { heat: result.newHeat } }),
    ...(result.involvedActorId && result.newBusyUntil
      ? [prisma.worldActor.update({ where: { id: result.involvedActorId }, data: { busyUntil: result.newBusyUntil } })]
      : []),
  ]);
}

/**
 * Separate, much rarer periodic beat: a "cartelera de recompensas" roundup
 * of a random sample of pirate WorldActors' canon bounties — satisfies the
 * user's "cada intervalo se publica recompensas de los piratas importantes"
 * ask without adding noise to the every-30-minutes ambient tick, whose
 * problem was content quality, not frequency. Purely flavor, never touches
 * player data.
 */
export async function tickBountyDigestIfDue(): Promise<void> {
  const clock = await prisma.worldClock.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, heat: 10 },
  });

  const now = new Date();
  if (clock.lastDigestAt && now.getTime() - clock.lastDigestAt.getTime() < DIGEST_INTERVAL_MS) return;

  await prisma.worldClock.update({ where: { id: 1 }, data: { lastDigestAt: now } });

  const candidates = await prisma.worldActor.findMany({
    where: { factionType: "PIRATE", canonBounty: { not: null } },
  });
  if (candidates.length === 0) return;

  const sample = [...candidates].sort(() => Math.random() - 0.5).slice(0, DIGEST_SAMPLE_SIZE);
  const entries = sample.map((a) => ({ name: a.name, factionName: a.factionName, canonBounty: formatBerries(a.canonBounty!) }));

  const fallbackBody = entries.map((e) => `${e.name} (${e.factionName}): ${e.canonBounty}`).join(" · ");
  const narrated = await narrateBountyDigest({ entries }, { headline: "Cartelera de recompensas del Gobierno Mundial", body: fallbackBody });

  await prisma.newsItem.create({
    data: { headline: narrated.headline, body: narrated.body, category: "Recompensas", severity: "digest" },
  });
}
