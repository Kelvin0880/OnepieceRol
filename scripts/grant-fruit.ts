// Test helper: grants a character the first unclaimed devil fruit directly,
// bypassing the random explore drop, for deterministic fruit-mechanic tests.
// Usage: npx tsx scripts/grant-fruit.ts <characterId>
import { prisma } from "../src/lib/db";

async function main() {
  const characterId = process.argv[2];
  if (!characterId) throw new Error("Usage: grant-fruit.ts <characterId>");
  const fruit = await prisma.devilFruit.findFirst({ where: { claimedBy: { is: null } } });
  if (!fruit) throw new Error("No unclaimed devil fruits left to grant.");
  await prisma.character.update({ where: { id: characterId }, data: { devilFruitId: fruit.id } });
  console.log("Granted", fruit.name, "to", characterId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
