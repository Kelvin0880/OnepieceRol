// Read-only: inventory rows and active missions of characters whose name contains the given text.
import "dotenv/config";
import { prisma } from "../src/lib/db";
async function main() {
  const chars = await prisma.character.findMany({ where: { name: { contains: process.argv[2] ?? "" } }, include: { devilFruit: { select: { name: true } } } });
  for (const c of chars) {
    console.log(`## ${c.name} lvl ${c.level} berries ${c.berries} fruit=${c.devilFruit?.name ?? "-"}`);
    const items = await prisma.inventoryItem.findMany({ where: { characterId: c.id } });
    console.log("items:", JSON.stringify(items.map((i) => `${i.kind}:${i.name}`)));
    const ms = await prisma.mission.findMany({ where: { characterId: c.id, status: "ACTIVE" } });
    for (const m of ms) console.log(`mission: ${m.title} ${m.progress}/${m.target} (${m.kind}) reward ${m.berries}b ${m.xp}xp`);
  }
}
main().finally(() => prisma.$disconnect());
