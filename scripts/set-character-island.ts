// Test helper: teleports a character to a given island id, bypassing travel/level gates.
// Usage: npx tsx scripts/set-character-island.ts <characterId> <islandId>
import { prisma } from "../src/lib/db";

async function main() {
  const [characterId, islandId] = process.argv.slice(2);
  if (!characterId || !islandId) throw new Error("Usage: set-character-island.ts <characterId> <islandId>");
  await prisma.character.update({ where: { id: characterId }, data: { currentIslandId: islandId } });
  console.log("Moved", characterId, "to", islandId);
}

main().finally(() => prisma.$disconnect());
