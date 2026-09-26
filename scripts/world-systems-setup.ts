// Test helper for world-systems-ui-check.mjs. Usage: npx tsx scripts/world-systems-setup.ts stage|impel <characterName>
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { startDispatch } from "../src/lib/game/admiral-dispatch";
import { takeCaptive } from "../src/lib/game/custody";

async function main() {
  const [mode, name] = process.argv.slice(2);
  const c = await prisma.character.findFirstOrThrow({ where: { name } });
  if (mode === "stage") {
    const jaya = await prisma.island.findUniqueOrThrow({ where: { name: "Jaya" } });
    const impel = await prisma.island.findUniqueOrThrow({ where: { name: "Impel Down" } });
    await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: jaya.id, level: 8, berries: 20000, hp: 100, maxHp: 100 } });
    await prisma.worldActor.updateMany({ where: { name: "Kaido" }, data: { status: "CAPTURED", prisonLevel: 4, capturedAt: new Date(), currentIslandId: impel.id } });
    const u = await prisma.user.create({ data: { username: `victima${Date.now() % 100000}`, passwordHash: "x" } });
    const v = await prisma.character.create({ data: { userId: u.id, name: `Victima${Date.now() % 100000}`, faction: "PIRATE", currentIslandId: jaya.id, level: 6, bounty: 8_000_000 } as never });
    await takeCaptive({ id: c.id, name: c.name }, { id: v.id, name: v.name, maxHp: v.maxHp, currentIslandId: jaya.id }, 40, "Jaya");
    await startDispatch({ islandId: jaya.id, manual: true, minutes: 30, admiralName: "Kizaru" });
    console.log("staged");
  } else {
    const impel = await prisma.island.findUniqueOrThrow({ where: { name: "Impel Down" } });
    await prisma.imprisonment.deleteMany({ where: { custodianId: c.id } });
    await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: impel.id, level: 46, hp: 400, maxHp: 400 } });
    console.log("impel");
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
