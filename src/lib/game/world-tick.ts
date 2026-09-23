import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { runWorldTick } from "../engine/world";

const TICK_INTERVAL_MS = 5 * 60 * 1000; // a new world beat roughly every 5 real minutes

/**
 * Lazily advances the background world simulation. Called opportunistically
 * from player-facing routes instead of a real cron job, which keeps this
 * deployable on a single free-tier web service with no extra infra — the
 * first request after the interval elapses pays the (tiny) cost of a tick.
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
      };
    }),
    actors.map((a) => ({ id: a.id, name: a.name, role: a.role, busyUntil: a.busyUntil }))
  );

  await prisma.worldClock.update({ where: { id: 1 }, data: { lastTickAt: now } });
  if (!result) return;

  await prisma.$transaction([
    prisma.newsItem.create({
      data: {
        headline: result.headline,
        body: result.body,
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
