// Test helper: puts a character on Isla Kairos at level 12 with berries to spare and (if it has none) a common
// devil fruit eaten, so the fruit-removal card can be driven in a browser. Prints the state as JSON.
// Usage: npx tsx scripts/kairos-setup.ts <characterId> [berries]
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { FRUIT_REMOVAL_ISLAND } from "../src/lib/engine/fruit-removal";

async function main() {
  const [id, berries] = process.argv.slice(2);
  if (!id) throw new Error("Usage: kairos-setup.ts <characterId> [berries]");
  const island = await prisma.island.findUniqueOrThrow({ where: { name: FRUIT_REMOVAL_ISLAND } });
  const c = await prisma.character.findUniqueOrThrow({ where: { id } });
  const fruit = c.devilFruitId ? null : await prisma.devilFruit.findFirstOrThrow({ where: { isSingleton: false, type: "PARAMECIA", claimedBy: { is: null } } });
  await prisma.character.update({
    where: { id },
    data: { currentIslandId: island.id, level: 12, berries: berries ? Number(berries) : 600_000, fruitMastery: 30, ...(fruit ? { devilFruitId: fruit.id } : {}) },
  });
  const after = await prisma.character.findUniqueOrThrow({ where: { id }, include: { devilFruit: true } });
  console.log(JSON.stringify({ fruit: after.devilFruit?.name ?? null, berries: after.berries, mastery: after.fruitMastery }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
