process.env.JUDGE_STUB = "1";
// The narrator opens the fight mode when a real resident starts the aggression. Usage: npx tsx scripts/fight-from-narration-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { startFightFromNarration } from "../src/lib/game/perform-action";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const island = await prisma.island.findFirstOrThrow({ where: { name: "Pueblo Foosha" } });
  const fighter = await prisma.islandNpc.findFirstOrThrow({ where: { islandId: island.id, category: { in: ["guard", "thug", "marine", "pirate"] }, status: "ALIVE" } });
  const u = await prisma.user.create({ data: { username: `fn${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const c = await prisma.character.create({ data: { name: `Duelista${Date.now() % 1000}`, faction: "PIRATE", userId: u.id, currentIslandId: island.id, level: 5, hp: 100, maxHp: 100, islandsVisited: JSON.stringify([island.id]) } });

  assert((await startFightFromNarration(c.id, "Alguien Que No Existe")) === null, "an invented name never starts a fight");
  assert((await prisma.pendingEncounter.findUnique({ where: { characterId: c.id } })) === null, "…and nothing is created");

  const notice = await startFightFromNarration(c.id, fighter.name);
  assert(!!notice && notice.includes(fighter.name), "a real resident starting the aggression opens the fight");
  const pe = await prisma.pendingEncounter.findUniqueOrThrow({ where: { characterId: c.id } });
  const enemy = JSON.parse(pe.enemyJson) as { name: string; islandNpcId?: string };
  assert(pe.phase === "fighting" && pe.roundNumber === 0, "it is a live fight, no round resolved yet");
  assert(enemy.name === fighter.name && enemy.islandNpcId === fighter.id, "the rival is that exact resident");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).hp === 100, "nobody was hurt by the announcement");
  assert((await startFightFromNarration(c.id, fighter.name)) === null, "already fighting: a second marker does nothing");

  await prisma.pendingEncounter.delete({ where: { characterId: c.id } });
  await prisma.character.delete({ where: { id: c.id } });
  await prisma.user.delete({ where: { id: u.id } });
  console.log("ALL FIGHT-FROM-NARRATION CHECKS PASSED");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
