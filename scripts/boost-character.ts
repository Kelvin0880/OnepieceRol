// Test helper: boosts a character's stats for deterministic rescue/combat testing.
// Usage: npx tsx scripts/boost-character.ts <characterId>
import { prisma } from "../src/lib/db";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Usage: boost-character.ts <characterId>");
  await prisma.character.update({ where: { id }, data: { strength: 90, agility: 90, durability: 90, level: 40 } });
  console.log("Boosted", id);
}

main().finally(() => prisma.$disconnect());
