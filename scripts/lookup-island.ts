// Test helper: prints an island row by name.
// Usage: npx tsx scripts/lookup-island.ts "Enies Lobby"
import { prisma } from "../src/lib/db";

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error("Usage: lookup-island.ts <islandName>");
  const island = await prisma.island.findUnique({ where: { name } });
  console.log(JSON.stringify(island));
}

main().finally(() => prisma.$disconnect());
