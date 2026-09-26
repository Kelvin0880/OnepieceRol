process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// A player captor carries a captive to a Government island: travels with them, no reward until delivered, escape after a day.
// Usage: npx tsx scripts/custody-check.ts (dev DB)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { takeCaptive, getCaptivesView, deliverCaptive, releaseCaptive, settleCustodyFor, CustodyError } from "../src/lib/game/custody";
import { travelCharacter } from "../src/lib/game/perform-action";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function mk(stamp: number, tag: string, faction: "PIRATE" | "MARINE", islandName: string) {
  const u = await prisma.user.create({ data: { username: `cu${tag}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${tag}${stamp}`, faction, "swordsman");
  const island = await prisma.island.findUniqueOrThrow({ where: { name: islandName } });
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: island.id, level: 10, bounty: 5_000_000, hp: 100, maxHp: 100, stamina: 100 } });
  return { id: c.id, user: u, name: c.name };
}

async function main() {
  const stamp = Date.now() % 100000;
  const captor = await mk(stamp, "Captor", "PIRATE", "Pueblo Foosha");
  const captive = await mk(stamp, "Cautivo", "PIRATE", "Pueblo Foosha");
  const foosha = await prisma.island.findUniqueOrThrow({ where: { name: "Pueblo Foosha" } });
  const before = (await prisma.character.findUniqueOrThrow({ where: { id: captor.id } })).berries;

  await takeCaptive({ id: captor.id, name: captor.name }, { id: captive.id, name: captive.name, maxHp: 100, currentIslandId: foosha.id }, 40, "Pueblo Foosha");
  const c1 = await prisma.character.findUniqueOrThrow({ where: { id: captive.id } });
  assert(c1.status === "IMPRISONED", "the loser becomes a prisoner in transit");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: captor.id } })).berries === before, "nothing is paid yet");
  const view = await getCaptivesView(captor.id);
  assert(!!view && view.captives.length === 1 && !view.governmentHere && /Gobierno/.test(view.hint), "the captor sees the prisoner and where to take them");
  let refused = false;
  try { await deliverCaptive(captor.id, captor.user.id, captive.id); } catch (e) { refused = e instanceof CustodyError; }
  assert(refused, "cannot hand over anywhere but a Government island");

  // The captive travels with the captor
  const next = (JSON.parse((await prisma.island.findUniqueOrThrow({ where: { id: foosha.id } })).connections) as string[])[0];
  await travelCharacter(captor.id, captor.user.id, next);
  const c2 = await prisma.character.findUniqueOrThrow({ where: { id: captive.id } });
  assert(c2.currentIslandId === next, "the captive sails with the captor");
  assert((await prisma.imprisonment.findUniqueOrThrow({ where: { characterId: captive.id } })).islandId === next, "and is held where the captor is");

  // Delivery at a Government island pays and jails for real
  const logue = await prisma.island.findUniqueOrThrow({ where: { name: "Loguetown" } });
  await prisma.character.updateMany({ where: { id: { in: [captor.id, captive.id] } }, data: { currentIslandId: logue.id } });
  await prisma.imprisonment.update({ where: { characterId: captive.id }, data: { islandId: logue.id } });
  assert((await getCaptivesView(captor.id))!.governmentHere, "Loguetown counts as a Government island");
  const out = await deliverCaptive(captor.id, captor.user.id, captive.id);
  const after = await prisma.character.findUniqueOrThrow({ where: { id: captor.id } });
  assert(after.berries > before, "the reward is paid on delivery");
  const im = await prisma.imprisonment.findUniqueOrThrow({ where: { characterId: captive.id } });
  assert(im.custodianId === null && (await prisma.character.findUniqueOrThrow({ where: { id: captive.id } })).status === "IMPRISONED", "now a real prisoner of the Government (no custodian)");
  assert(/entrega/i.test(out.log[0]) && (await prisma.newsItem.count({ where: { headline: { contains: "entrega a" } } })) > 0, "the delivery is in the news");

  // A captive escapes after a day
  const c3 = await mk(stamp, "Otro", "PIRATE", "Jaya");
  const v = await mk(stamp, "Victima", "PIRATE", "Jaya");
  const jaya = await prisma.island.findUniqueOrThrow({ where: { name: "Jaya" } });
  await takeCaptive({ id: c3.id, name: c3.name }, { id: v.id, name: v.name, maxHp: 100, currentIslandId: jaya.id }, 40, "Jaya");
  await prisma.imprisonment.update({ where: { characterId: v.id }, data: { capturedAt: new Date(Date.now() - 25 * 3600_000) } });
  await settleCustodyFor(v.id);
  assert((await prisma.character.findUniqueOrThrow({ where: { id: v.id } })).status === "ALIVE", "after 24 h the captive gets away");

  // The captor may let go
  await takeCaptive({ id: c3.id, name: c3.name }, { id: v.id, name: v.name, maxHp: 100, currentIslandId: jaya.id }, 40, "Jaya").catch(() => undefined);
  await prisma.imprisonment.deleteMany({ where: { characterId: v.id } });
  await takeCaptive({ id: c3.id, name: c3.name }, { id: v.id, name: v.name, maxHp: 100, currentIslandId: jaya.id }, 40, "Jaya");
  await releaseCaptive(c3.id, c3.user.id, v.id);
  assert((await prisma.character.findUniqueOrThrow({ where: { id: v.id } })).status === "ALIVE", "letting go frees the prisoner");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
