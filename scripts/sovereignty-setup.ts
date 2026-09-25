process.env.JUDGE_STUB = "1";
// Test helper for scripts/sovereignty-ui-check.mjs: turns a fresh pirate into a Yonko aspirant standing next to Shanks
// (level 40, 1.500 M bounty, Whisky Peak as their island, three nakamas). Usage: npx tsx scripts/sovereignty-setup.ts "<name>"
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const c = await prisma.character.findFirstOrThrow({ where: { name: process.argv[2] } });
  const shanks = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Shanks" } });
  await prisma.worldActor.update({ where: { id: shanks.id }, data: { busyUntil: null } });
  await prisma.character.update({ where: { id: c.id }, data: { level: 40, attrLevelGranted: 40, bounty: 1_500_000_000, berries: 50_000_000, hp: 900, maxHp: 900, currentIslandId: shanks.currentIslandId! } });
  const whisky = await prisma.island.findUniqueOrThrow({ where: { name: "Whisky Peak" } });
  await prisma.territory.update({ where: { islandId: whisky.id }, data: { ownerActorId: null, ownerCharacterId: c.id, ownerName: c.name, title: "Señor de Whisky Peak" } });
  for (const n of ["Jorge", "Marta", "Tobi"]) await prisma.nPCCompanion.create({ data: { characterId: c.id, name: n, role: "Luchador", hp: 100, maxHp: 100, loyalty: 80 } });
  console.log("ready at", shanks.currentIslandId);
}
main().finally(() => prisma.$disconnect());
