// Test helper: sets a character's poneglyphHeat directly for deterministic pursuit testing.
// Usage: npx tsx scripts/set-poneglyph-heat.ts <characterId> <heat>
import { prisma } from "../src/lib/db";

async function main() {
  const [id, heatStr] = process.argv.slice(2);
  if (!id || !heatStr) throw new Error("Usage: set-poneglyph-heat.ts <characterId> <heat>");
  await prisma.character.update({ where: { id }, data: { poneglyphHeat: Number(heatStr) } });
  console.log("Set poneglyphHeat =", heatStr, "for", id);
}

main().finally(() => prisma.$disconnect());
