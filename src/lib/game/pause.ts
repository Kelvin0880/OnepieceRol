import { prisma } from "../db";
import { PAUSE_SHIFT, shiftDate } from "../engine/pause";

type Db = typeof prisma;
type Delegate = {
  findMany(args: unknown): Promise<Record<string, unknown>[]>;
  update(args: unknown): unknown;
};

const CACHE_MS = 5_000;
let cache: { at: number; pausedAt: Date | null } | null = null;

/** When the game was paused, or null while it runs. Cached for a few seconds; a failed read never blocks anything. */
export async function getPausedAt(db: Db = prisma): Promise<Date | null> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.pausedAt;
  try {
    const row = await db.worldClock.findUnique({ where: { id: 1 }, select: { pausedAt: true } });
    cache = { at: now, pausedAt: row?.pausedAt ?? null };
  } catch {
    return cache?.pausedAt ?? null;
  }
  return cache.pausedAt;
}

export async function isPaused(): Promise<boolean> {
  return (await getPausedAt()) !== null;
}

export function forgetPauseCache(): void {
  cache = null;
}

export async function pauseGame(db: Db = prisma, now = new Date()): Promise<{ since: Date; already: boolean }> {
  const clock = await db.worldClock.upsert({ where: { id: 1 }, update: {}, create: { id: 1, heat: 10 }, select: { pausedAt: true } });
  if (clock.pausedAt) return { since: clock.pausedAt, already: true };
  await db.worldClock.update({ where: { id: 1 }, data: { pausedAt: now } });
  forgetPauseCache();
  return { since: now, already: false };
}

/** Moves every world clock forward by the paused time and unfreezes, all in one transaction (a failure changes nothing). */
export async function resumeGame(db: Db = prisma, now = new Date()): Promise<{ pausedMs: number; shifted: Record<string, number> } | null> {
  const clock = await db.worldClock.findUnique({ where: { id: 1 }, select: { pausedAt: true } });
  if (!clock?.pausedAt) return null;
  const pausedMs = Math.max(0, now.getTime() - clock.pausedAt.getTime());
  const ops: unknown[] = [];
  const shifted: Record<string, number> = {};

  for (const rule of PAUSE_SHIFT) {
    const delegate = (db as unknown as Record<string, Delegate>)[rule.model.charAt(0).toLowerCase() + rule.model.slice(1)];
    const select = Object.fromEntries(["id", ...rule.columns].map((c) => [c, true]));
    const rows = await delegate.findMany({ where: rule.where, select });
    for (const row of rows) {
      const data: Record<string, Date> = {};
      for (const column of rule.columns) {
        const value = row[column];
        if (value instanceof Date) data[column] = shiftDate(value, pausedMs);
      }
      if (Object.keys(data).length === 0) continue;
      ops.push(delegate.update({ where: { id: row.id }, data }));
      shifted[rule.model] = (shifted[rule.model] ?? 0) + 1;
    }
  }
  ops.push(db.worldClock.update({ where: { id: 1 }, data: { pausedAt: null } }));
  await db.$transaction(ops as never);
  forgetPauseCache();
  return { pausedMs, shifted };
}
