process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Owner pause (PAUSA.md), against the dev DB: while paused the world clock does not tick and the AI client refuses
// to call out; resuming moves every live clock forward by exactly the paused time and never twice.
// Usage: npx tsx scripts/pause-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { pauseGame, resumeGame, isPaused, forgetPauseCache, getPausedAt } from "../src/lib/game/pause";
import { tickWorldIfDue } from "../src/lib/game/world-tick";
import { callOpenRouter, AiUnavailableError } from "../src/lib/ai/openrouter-client";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
const HOUR = 3_600_000;

async function main() {
  const now = new Date();
  const paused0 = new Date(now.getTime() - 3 * HOUR);
  if (await getPausedAt()) await resumeGame();

  const taken = (await prisma.territory.findMany({ select: { islandId: true } })).map((x) => x.islandId);
  const island = await prisma.island.findFirstOrThrow({ where: { id: { notIn: taken } } });
  const u = await prisma.user.create({ data: { username: `pau${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const seen = new Date(now.getTime() - 5 * HOUR);
  const trained = new Date(now.getTime() - 10 * 60_000);
  const arrives = new Date(now.getTime() + 20 * 60_000);
  const c = await prisma.character.create({
    data: { name: `Pausado${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: island.id, lastTrainedAt: trained, voyageArrivesAt: arrives, lastSeenAt: seen },
  });
  const t = await prisma.territory.create({ data: { islandId: island.id, ownerName: "Prueba", title: "Prueba", lastPressureAt: new Date(now.getTime() - 3 * HOUR) } });
  const actor = await prisma.worldActor.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const busy = new Date(now.getTime() + HOUR);
  await prisma.worldActor.update({ where: { id: actor.id }, data: { busyUntil: busy } });
  const clockBefore = await prisma.worldClock.upsert({ where: { id: 1 }, update: {}, create: { id: 1, heat: 10 } });
  const staleTick = new Date(now.getTime() - 2 * HOUR);
  await prisma.worldClock.update({ where: { id: 1 }, data: { lastTickAt: staleTick } });
  const newsBefore = await prisma.newsItem.count();

  try {
    // ---- paused: nothing advances, nothing is spent
    const r = await pauseGame(prisma, paused0);
    assert(!r.already && (await isPaused()), "pausing freezes the game");
    assert((await pauseGame(prisma)).already, "pausing twice keeps the first moment");
    await tickWorldIfDue();
    const tickedWhilePaused = await prisma.worldClock.findUniqueOrThrow({ where: { id: 1 } });
    assert(tickedWhilePaused.lastTickAt.getTime() === staleTick.getTime() && (await prisma.newsItem.count()) === newsBefore, "an overdue world tick does nothing while paused");
    let refused = false;
    try {
      await callOpenRouter("s", "u", { models: ["x/y"] });
    } catch (e) {
      refused = e instanceof AiUnavailableError && /paused/.test((e as Error).message);
    }
    assert(refused, "the AI client refuses to call out while paused");

    // ---- resume: every live clock moves forward by exactly the paused time (3 h)
    const res = await resumeGame(prisma, now);
    assert(res !== null && Math.abs(res.pausedMs - 3 * HOUR) < 1000 && !(await isPaused()), "resuming reports the paused time and unfreezes");
    const after = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
    assert(after.lastTrainedAt!.getTime() === trained.getTime() + (now.getTime() - paused0.getTime()), "a training cooldown keeps the time it had left");
    assert(after.voyageArrivesAt!.getTime() === arrives.getTime() + (now.getTime() - paused0.getTime()), "a voyage in progress arrives later by the paused time");
    assert(after.lastSeenAt!.getTime() === seen.getTime(), "presence (last seen) is left alone");
    const tAfter = await prisma.territory.findUniqueOrThrow({ where: { id: t.id } });
    assert(tAfter.lastPressureAt.getTime() === t.lastPressureAt.getTime() + (now.getTime() - paused0.getTime()), "a territory's garrison clock does not run during the pause");
    const aAfter = await prisma.worldActor.findUniqueOrThrow({ where: { id: actor.id } });
    assert(aAfter.busyUntil!.getTime() === busy.getTime() + (now.getTime() - paused0.getTime()), "a busy canon character stays busy for as long as it had left");
    const clockAfter = await prisma.worldClock.findUniqueOrThrow({ where: { id: 1 } });
    assert(clockAfter.lastTickAt.getTime() === staleTick.getTime() + (now.getTime() - paused0.getTime()) && clockAfter.pausedAt === null, "the world clock is shifted too, so no beat fires at once");
    forgetPauseCache();
    assert((await resumeGame(prisma)) === null, "resuming when not paused does nothing (no double shift)");
    assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).lastTrainedAt!.getTime() === after.lastTrainedAt!.getTime(), "and moves nothing");
  } finally {
    await prisma.territory.delete({ where: { id: t.id } }).catch(() => undefined);
    await prisma.character.delete({ where: { id: c.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    await prisma.worldActor.update({ where: { id: actor.id }, data: { busyUntil: actor.busyUntil } });
    await prisma.worldClock.update({ where: { id: 1 }, data: { lastTickAt: clockBefore.lastTickAt, pausedAt: null } });
    forgetPauseCache();
  }
  console.log("pause-check: all good");
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
