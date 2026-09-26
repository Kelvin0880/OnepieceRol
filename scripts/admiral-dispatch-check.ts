process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Admiral dispatch end to end on the dev DB: protections, the alert, arrival, everyone on the island pulled in, no way out,
// captures on defeat, and the empty-handed return. Usage: npx tsx scripts/admiral-dispatch-check.ts (freshly seeded DB)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { startDispatch, tickAdmiralDispatch, getDispatchAlertFor, DispatchError } from "../src/lib/game/admiral-dispatch";
import { getOpenJointFightFor, submitJointAction } from "../src/lib/game/joint-fight";
import { travelCharacter } from "../src/lib/game/perform-action";
import { worldStateBlock, invalidateWorldState } from "../src/lib/game/world-state";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function mk(stamp: number, tag: string, faction: "PIRATE" | "MARINE", level: number, islandName: string) {
  const u = await prisma.user.create({ data: { username: `ad${tag}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${tag}${stamp}`, faction, "swordsman");
  const island = await prisma.island.findUniqueOrThrow({ where: { name: islandName } });
  await prisma.character.update({ where: { id: c.id }, data: { level, currentIslandId: island.id, hp: 100, maxHp: 100 } });
  return { user: u, id: c.id, name: c.name, islandId: island.id };
}

async function main() {
  const stamp = Date.now() % 100000;
  const jaya = await prisma.island.findUniqueOrThrow({ where: { name: "Jaya" } });
  const foosha = await prisma.island.findUniqueOrThrow({ where: { name: "Pueblo Foosha" } });
  const a = await mk(stamp, "Uno", "PIRATE", 3, "Jaya");
  const b = await mk(stamp, "Dos", "PIRATE", 4, "Jaya");
  const rookie = await mk(stamp, "Novato", "PIRATE", 1, "Jaya");
  const marine = await mk(stamp, "Marino", "MARINE", 20, "Jaya");

  // Protections
  for (const name of ["Pueblo Foosha", "Isla Baltigo", "Isla del Toro Negro", "Whole Cake Island"]) {
    const isl = await prisma.island.findUniqueOrThrow({ where: { name } });
    let refused = false;
    try { await startDispatch({ islandId: isl.id, manual: true }); } catch (e) { refused = e instanceof DispatchError; }
    assert(refused, `${name} can never be attacked`);
  }
  assert((await prisma.admiralDispatch.count()) === 0, "nothing was launched on protected islands");

  // Launch on Jaya
  const d = (await startDispatch({ islandId: jaya.id, manual: true, minutes: 30 }))!;
  assert(d.status === "EN_ROUTE" && d.targetIslandName === "Jaya", "an admiral is on the way to Jaya");
  const alert = await getDispatchAlertFor(a.id);
  assert(!!alert && alert.status === "EN_ROUTE" && alert.hunted && alert.msLeft > 20 * 60_000, "the pirate sees the alert with a countdown");
  assert(!(await getDispatchAlertFor(marine.id))?.hunted, "a Marine on the island is informed, not hunted");
  assert(!(await getDispatchAlertFor((await mk(stamp, "Lejos", "PIRATE", 5, "Loguetown")).id)), "another island sees nothing");
  invalidateWorldState();
  assert(/navega hacia Jaya/.test(await worldStateBlock()), "the AI world state knows the admiral is sailing");
  const adm = await prisma.worldActor.findUniqueOrThrow({ where: { id: d.admiralActorId } });
  assert(adm.locationKind === "sea" && adm.seaToIslandId === jaya.id, "the codex shows him at sea toward Jaya");
  assert((await startDispatch({ manual: false })) === null, "only one admiral at a time");
  let second = false;
  try { await startDispatch({ manual: true }); } catch (e) { second = e instanceof DispatchError; }
  assert(second, "a manual second dispatch is refused");

  // Arrival: pulled in, pirates only, level 2+
  await prisma.admiralDispatch.update({ where: { id: d.id }, data: { arrivesAt: new Date(Date.now() - 1000) } });
  await tickAdmiralDispatch();
  const after = await prisma.admiralDispatch.findUniqueOrThrow({ where: { id: d.id } });
  assert(after.status === "ARRIVED" && !!after.jointFightId, "on arrival the fight starts by itself");
  const fight = await prisma.jointFight.findUniqueOrThrow({ where: { id: after.jointFightId! }, include: { participants: true, messages: { orderBy: { createdAt: "asc" } } } });
  const names = fight.participants.map((p) => p.name);
  assert(fight.kind === "admiral" && names.includes(a.name) && names.includes(b.name), "everyone hunted on the island shares the scene");
  assert(!names.includes(rookie.name) && !names.includes(marine.name), "level-1 pirates and Marines are left out");
  assert(/TODAS las acciones/.test(fight.messages[fight.messages.length - 1].text), "the admiral opens: everyone answers, then he answers all");
  assert(!!(await getOpenJointFightFor(a.id)), "the players are inside the fight");
  let blocked = false;
  try { await travelCharacter(a.id, a.user.id, foosha.id); } catch { blocked = true; }
  assert(blocked, "nobody can sail away mid-fight");

  // A pirate who arrives late is dragged in too
  const late = await mk(stamp, "Tarde", "PIRATE", 6, "Jaya");
  await getDispatchAlertFor(late.id);
  const { joinAdmiralFightIfNeeded } = await import("../src/lib/game/admiral-dispatch");
  await joinAdmiralFightIfNeeded(late.id);
  assert(!!(await getOpenJointFightFor(late.id)), "a late arrival is pulled into the fight");

  // The admiral wins: every fallen player is captured, the event ends, the news say who
  for (let i = 0; i < 25; i++) {
    const f = await prisma.jointFight.findUniqueOrThrow({ where: { id: fight.id }, include: { participants: true } });
    if (f.status !== "ACTIVE") break;
    for (const p of f.participants.filter((x) => !x.isNpc && x.status === "FIGHTING" && !x.action)) {
      const owner = [a, b, late].find((x) => x.id === p.characterId)!;
      await submitJointAction(owner.id, owner.user.id, "Ataco al almirante con todo lo que tengo, sin rendirme.").catch(() => undefined);
    }
  }
  const end = await prisma.jointFight.findUniqueOrThrow({ where: { id: fight.id } });
  assert(end.status === "LOST", "the fight ends when every pirate is beaten");
  for (const p of [a, b, late]) {
    const c = await prisma.character.findUniqueOrThrow({ where: { id: p.id } });
    assert(c.status === "IMPRISONED", `${p.name} is captured, not dead`);
  }
  assert((await prisma.character.findUniqueOrThrow({ where: { id: rookie.id } })).status === "ALIVE", "the rookie was never touched");
  const done = await prisma.admiralDispatch.findUniqueOrThrow({ where: { id: d.id } });
  assert(done.status === "ENDED" && (JSON.parse(done.captured) as string[]).length === 3, "the dispatch ends with the list of captured");
  assert((await prisma.newsItem.count({ where: { headline: { contains: "capturados" }, islandId: jaya.id } })) > 0, "the news tell who was captured");

  // Empty-handed: nobody hunted on the island -> he sails home in the same time
  await prisma.admiralDispatch.update({ where: { id: d.id }, data: { endedAt: new Date(Date.now() - 13 * 3600_000) } });
  await prisma.worldActor.update({ where: { id: d.admiralActorId }, data: { busyUntil: null } });
  await prisma.character.updateMany({ where: { id: { in: [a.id, b.id, late.id, rookie.id] } }, data: { currentIslandId: foosha.id, status: "ALIVE" } });
  await prisma.imprisonment.deleteMany({});
  await prisma.character.updateMany({ where: { id: { in: [a.id] } }, data: { currentIslandId: jaya.id } });
  const d2 = (await startDispatch({ islandId: jaya.id, manual: true, minutes: 5, admiralName: d.admiralName }))!;
  await prisma.character.update({ where: { id: a.id }, data: { currentIslandId: foosha.id } });
  await prisma.admiralDispatch.update({ where: { id: d2.id }, data: { arrivesAt: new Date(Date.now() - 1000) } });
  await tickAdmiralDispatch();
  const back = await prisma.admiralDispatch.findUniqueOrThrow({ where: { id: d2.id } });
  assert(back.status === "RETURNING" && !!back.returnsAt && back.returnsAt.getTime() - Date.now() > 4 * 60_000 && back.returnsAt.getTime() - Date.now() < 6 * 60_000, "finding nobody, he takes the same time to sail home");
  await prisma.admiralDispatch.update({ where: { id: d2.id }, data: { returnsAt: new Date(Date.now() - 1000) } });
  await tickAdmiralDispatch();
  assert((await prisma.admiralDispatch.findUniqueOrThrow({ where: { id: d2.id } })).status === "ENDED", "the return closes the event");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
