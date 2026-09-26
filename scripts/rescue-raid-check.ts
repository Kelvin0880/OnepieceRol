process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Rescue raid on Impel Down: requirements by cell, the guard fight, and the freed canon prisoner. Usage: npx tsx scripts/rescue-raid-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { getRescueRaidState, startRescueRaid, RescueRaidError } from "../src/lib/game/rescue-raid";
import { closeJointFight } from "../src/lib/game/joint-fight";
import { worldStateBlock, invalidateWorldState } from "../src/lib/game/world-state";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function main() {
  const stamp = Date.now() % 100000;
  const impel = await prisma.island.findUniqueOrThrow({ where: { name: "Impel Down" } });
  const u = await prisma.user.create({ data: { username: `rr${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `Rescatador${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { level: 46, currentIslandId: impel.id, hp: 400, maxHp: 400 } });
  const shallow = await prisma.worldActor.findFirstOrThrow({ where: { name: "Kaido" } });
  const deep = await prisma.worldActor.findFirstOrThrow({ where: { name: { startsWith: "Charlotte Linlin" } } });
  await prisma.worldActor.update({ where: { id: shallow.id }, data: { status: "CAPTURED", prisonLevel: 1, capturedAt: new Date(), currentIslandId: impel.id } });
  await prisma.worldActor.update({ where: { id: deep.id }, data: { status: "CAPTURED", prisonLevel: 6, capturedAt: new Date(), currentIslandId: impel.id } });

  const state = await getRescueRaidState(c.id);
  assert(!!state && state.prisoners.length === 3 && state.prisoners.some((p) => p.name.includes("Doflamingo") && p.cell === 6), "on Impel Down the player sees the canon prisoners (Doflamingo waits on level 6)");
  assert(state!.prisoners.find((p) => p.cell === 6)!.blockReason !== null, "the deepest cell is out of reach for a lone level-46");
  assert(state!.prisoners.find((p) => p.cell === 1)!.blockReason === null, "the shallowest is within reach");
  let refused = false;
  try { await startRescueRaid(c.id, u.id, deep.id); } catch (e) { refused = e instanceof RescueRaidError; }
  assert(refused, "the deep rescue is refused");

  const started = await startRescueRaid(c.id, u.id, shallow.id);
  const fight = await prisma.jointFight.findUniqueOrThrow({ where: { id: started.fightId } });
  assert(fight.kind === "rescue", "a rescue fight against the guard begins");
  await prisma.jointFight.update({ where: { id: fight.id }, data: { enemyHp: 10 } });
  await prisma.jointFightMessage.create({ data: { fightId: fight.id, authorCharacterId: null, authorName: "Narrador", text: "El guardia mayor cae de rodillas y suelta las llaves." } });
  const res = await closeJointFight(c.id, u.id);
  assert(res.finished && res.outcome === "victory", "beating the guard wins the raid");
  const freed = await prisma.worldActor.findUniqueOrThrow({ where: { id: shallow.id } });
  assert(freed.status === "ACTIVE" && freed.prisonLevel === null && freed.locationHidden, "the prisoner is free and in hiding");
  assert((await prisma.newsItem.count({ where: { headline: { contains: "liberado de Impel Down" } } })) > 0, "the news report the breakout");
  invalidateWorldState();
  const world = await worldStateBlock();
  assert(!/PRESOS[^.]*Kaido/.test(world) && /PRESOS[^.]*Linlin/.test(world), "the AI world state drops the freed one and keeps the other");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
