// Read-only: dumps the latest scene messages (solo + shared party) of characters whose name contains the given text.
// Usage: npx tsx scripts/dump-scenes.ts Sebasti 80
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const q = process.argv[2] ?? "";
  const take = Number(process.argv[3] ?? 60);
  const chars = await prisma.character.findMany({ where: { name: { contains: q } }, select: { id: true, name: true, berries: true, partyId: true } });
  for (const c of chars) {
    console.log(`##### ${c.name} (${c.id}) berries=${c.berries} party=${c.partyId}`);
    const solo = (await prisma.sceneMessage.findMany({ where: { characterId: c.id }, orderBy: { createdAt: "desc" }, take })).reverse();
    for (const m of solo) console.log(`\n[${m.createdAt.toISOString().slice(5, 16)}] ${m.role}: ${m.text}`);
    if (c.partyId) {
      const party = (await prisma.partySceneMessage.findMany({ where: { partyId: c.partyId }, orderBy: { createdAt: "desc" }, take })).reverse();
      console.log("\n--- PARTY ---");
      for (const m of party) console.log(`\n[${m.createdAt.toISOString().slice(5, 16)}] ${JSON.stringify(m).slice(0, 1800)}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
