import { prisma } from "../db";
import { varietyRng } from "../engine/rng";
import { HAPPENING_CATEGORY, HAPPENING_MEMORY, fallbackHappening, happeningDue, pickSeeds } from "../engine/world-happenings";
import { inventHappening } from "../ai/world-happening";
import { logError } from "../log-error";

let running = false;

/**
 * Lazily publishes one AI-invented happening per 24 h (fire-and-forget from the world tick). The publication time of the
 * newest one IS the clock, so no schema is needed and a restart never double-fires.
 */
export async function tickWorldHappenings(now = new Date()): Promise<boolean> {
  if (running) return false;
  running = true;
  try {
    const recent = await prisma.newsItem.findMany({ where: { category: HAPPENING_CATEGORY }, orderBy: { createdAt: "desc" }, take: HAPPENING_MEMORY, select: { headline: true, createdAt: true } });
    if (!happeningDue(recent[0]?.createdAt ?? null, now)) return false;
    const [islands, clock] = await Promise.all([prisma.island.findMany({ select: { id: true, name: true, sea: true, dangerLevel: true, factionControl: true } }), prisma.worldClock.findUnique({ where: { id: 1 } })]);
    if (islands.length === 0) return false;
    const rng = varietyRng(`happening:${Math.floor(now.getTime() / 3_600_000)}`);
    const seeds = pickSeeds(rng, [], 3);
    const ai = await inventHappening({
      islands: islands.map((i) => ({ name: i.name, sea: String(i.sea), danger: i.dangerLevel, control: i.factionControl })),
      recentHeadlines: recent.map((r) => r.headline),
      seeds,
      heat: clock?.heat ?? 10,
    });
    const fallbackIsland = islands[Math.floor(rng() * islands.length)];
    const h = ai ?? fallbackHappening(seeds[0], fallbackIsland.name);
    const island = islands.find((i) => i.name === h.islandName) ?? fallbackIsland;
    // Re-check right before writing: another request may have published while the AI was thinking.
    const again = await prisma.newsItem.findFirst({ where: { category: HAPPENING_CATEGORY }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (!happeningDue(again?.createdAt ?? null, new Date())) return false;
    await prisma.newsItem.create({ data: { headline: h.headline, body: h.body, category: HAPPENING_CATEGORY, severity: "normal", islandId: island.id, locationName: island.name } });
    return true;
  } catch (err) {
    await logError("world-happenings/tick", err);
    return false;
  } finally {
    running = false;
  }
}

/** The last few days of happenings, as narrator context: what is going on around this island right now. */
export async function recentHappeningsFor(islandId: string, take = 3): Promise<string[]> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const rows = await prisma.newsItem.findMany({ where: { category: HAPPENING_CATEGORY, islandId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take, select: { headline: true, body: true } });
  return rows.map((r) => `${r.headline}: ${r.body.slice(0, 220)}`);
}
