process.env.JUDGE_STUB = "1";
process.env.EVENT_STUB = "1";
// Beginner events against the dev DB (needs a seeded DB: npm run db:reset).
// Usage: npx tsx scripts/player-events-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { availableEventFruits, cancelPlayerEvent, createPlayerEvent, forceResolvePlayerEvent, getEventsFor, joinEvent, resolveIfReady, submitEventEntry, withdrawFromEvent, EVENT_NEWS_CATEGORY, PlayerEventError } from "../src/lib/game/player-events";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>, part: string) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof PlayerEventError && e.message.includes(part);
  }
}

async function main() {
  const foosha = await prisma.island.findFirstOrThrow({ where: { name: { contains: "Foosha" } } });
  const other = await prisma.island.findFirstOrThrow({ where: { name: { contains: "Baratie" } } });
  const stamp = Date.now() % 100000;
  const made: { u: string; c: string }[] = [];
  const mk = async (tag: string, level: number, islandId = foosha.id) => {
    const u = await prisma.user.create({ data: { username: `pe${tag}${stamp}${Math.floor(Math.random() * 1e6)}`, passwordHash: "x" } });
    const c = await prisma.character.create({ data: { name: `${tag}${stamp}`, faction: "PIRATE", userId: u.id, currentIslandId: islandId, level, berries: 100 } });
    made.push({ u: u.id, c: c.id });
    return { u: u.id, c: c.id, name: c.name };
  };
  const created: string[] = [];
  try {
    const fruitsBefore = (await availableEventFruits()).length;
    assert(fruitsBefore >= 12, "the invented event fruits exist in the database and are unowned");

    const ev = await createPlayerEvent({ withFruit: true, islandName: foosha.name, maxLevel: 10, createdBy: "check" });
    created.push(ev.id);
    assert(ev.status === "OPEN" && !!ev.rewardFruitName && !!ev.rewardFruitId, "an event is created with a unique fruit reserved");
    assert((await prisma.playerEventEntry.count({ where: { eventId: ev.id, isNpc: true } })) === 3, "with 3 NPC rivals already entered");
    assert((await availableEventFruits()).length === fruitsBefore - 1, "the reserved fruit is no longer offered to another event");
    assert((await prisma.newsItem.count({ where: { category: EVENT_NEWS_CATEGORY, headline: { contains: ev.title } } })) >= 1, "the announcement is in the news");

    const p1 = await mk("Ana", 2);
    const p2 = await mk("Beto", 8);
    const far = await mk("Lejos", 3, other.id);
    const strong = await mk("Fuerte", 20);
    assert(await rejects(() => joinEvent(far.c, far.u, ev.id), "isla del evento"), "you must be on the island to join");
    assert(await rejects(() => joinEvent(strong.c, strong.u, ev.id), "hasta 10"), "too high a level is refused");
    await joinEvent(p1.c, p1.u, ev.id);
    await joinEvent(p2.c, p2.u, ev.id);
    assert(await rejects(() => joinEvent(p1.c, p1.u, ev.id), "Ya estás"), "joining twice is refused");
    assert(await rejects(() => joinEvent(p1.c, "otro", ev.id), "no encontrado"), "nobody joins with someone else's character");
    const view = await getEventsFor(p1.c, p1.u);
    assert(view.open.length === 1 && view.open[0].participants.length === 5 && view.open[0].mine?.status === "REGISTERED", "the player sees the event, its 5 participants and their own state");

    assert(await rejects(() => submitEventEntry(p1.c, p1.u, ev.id, "corto"), "detalle"), "a one-word attempt is refused");
    await submitEventEntry(p1.c, p1.u, ev.id, "Preparo una red y espero a que el pez pique en la marea baja, con calma y paciencia.");
    assert((await prisma.playerEvent.findUniqueOrThrow({ where: { id: ev.id } })).status === "OPEN", "the event stays open while another human has not finished (no time limit)");
    assert(await rejects(() => submitEventEntry(p1.c, p1.u, ev.id, "x".repeat(40)), "ya enviaste"), "handing in twice is refused");
    assert((await prisma.newsItem.count({ where: { category: EVENT_NEWS_CATEGORY, body: { contains: "ha completado la prueba" } } })) >= 1, "the progress is in the news");

    await submitEventEntry(p2.c, p2.u, ev.id, "Estudio las corrientes, uso mi Haki de observación para leer el banco de peces y tiendo trampas escalonadas. ".repeat(6));
    assert((await prisma.playerEvent.findUniqueOrThrow({ where: { id: ev.id } })).status === "OPEN", "even when every entrant has finished, the registration window keeps the event open");
    await prisma.playerEvent.update({ where: { id: ev.id }, data: { createdAt: new Date(Date.now() - 7 * 3600_000) } });
    await resolveIfReady(ev.id);
    const done = await prisma.playerEvent.findUniqueOrThrow({ where: { id: ev.id } });
    assert(done.status === "RESOLVED" && done.winnerName === p2.name, "when the last human finishes the judge crowns the best entry");
    assert(!!done.resultText && done.resultText.includes("Clasificación"), "the result lists the whole ranking");
    const bag = await prisma.inventoryItem.findMany({ where: { characterId: p2.c, kind: "Fruta del Diablo" } });
    assert(bag.length === 1 && bag[0].name === ev.rewardFruitName, "the winner receives the unique fruit in the bag");
    const w = await prisma.character.findUniqueOrThrow({ where: { id: p2.c } });
    const l = await prisma.character.findUniqueOrThrow({ where: { id: p1.c } });
    assert(w.berries >= 100 + ev.rewardBerries, "and the berries");
    assert(l.berries > 100 && l.berries < 100 + ev.rewardBerries, "the loser gets only a consolation");
    assert((await prisma.inventoryItem.count({ where: { characterId: p1.c, kind: "Fruta del Diablo" } })) === 0, "and no fruit");
    assert((await prisma.newsItem.count({ where: { category: EVENT_NEWS_CATEGORY, headline: { contains: `gana ${p2.name}` } } })) === 1, "the winner and the reward are in the news");
    assert(!(await availableEventFruits()).some((f) => f.id === ev.rewardFruitId), "the claimed fruit is never offered again");
    assert(!(await resolveIfReady(ev.id)), "a resolved event cannot be resolved twice");

    // withdrawal lets the rest finish
    const ev2 = await createPlayerEvent({ withFruit: false, islandName: foosha.name, maxLevel: 10, createdBy: "check" });
    created.push(ev2.id);
    const q1 = await mk("Cami", 4);
    const q2 = await mk("Dani", 4);
    await joinEvent(q1.c, q1.u, ev2.id);
    await joinEvent(q2.c, q2.u, ev2.id);
    await submitEventEntry(q1.c, q1.u, ev2.id, "Sigo el rastro de huellas hasta el claro y preparo un señuelo con carne salada para atraerlo.");
    await prisma.playerEvent.update({ where: { id: ev2.id }, data: { createdAt: new Date(Date.now() - 7 * 3600_000) } });
    await withdrawFromEvent(q2.c, q2.u, ev2.id);
    assert((await prisma.playerEvent.findUniqueOrThrow({ where: { id: ev2.id } })).status === "RESOLVED", "if the last unfinished human withdraws the event closes");

    // stuck event: the owner can force it or cancel it, and the fruit returns
    const ev3 = await createPlayerEvent({ withFruit: true, islandName: foosha.name, maxLevel: 10, createdBy: "check" });
    created.push(ev3.id);
    assert(await rejects(() => forceResolvePlayerEvent(ev3.id), "ningún intento"), "forcing an event nobody played is refused");
    const free = (await availableEventFruits()).length;
    await cancelPlayerEvent(ev3.id);
    assert((await availableEventFruits()).length === free + 1, "cancelling frees the reserved fruit");
    assert((await prisma.newsItem.count({ where: { category: EVENT_NEWS_CATEGORY, headline: { contains: "Evento cancelado" } } })) >= 1, "and announces it");
  } finally {
    for (const id of created) {
      await prisma.playerEventEntry.deleteMany({ where: { eventId: id } });
      await prisma.playerEvent.delete({ where: { id } }).catch(() => undefined);
    }
    const ids = made.map((x) => x.c);
    await prisma.inventoryItem.deleteMany({ where: { characterId: { in: ids } } });
    await prisma.newsItem.deleteMany({ where: { category: EVENT_NEWS_CATEGORY } });
    for (const x of made) {
      await prisma.character.delete({ where: { id: x.c } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: x.u } }).catch(() => undefined);
    }
  }
  console.log("ALL PASS");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
