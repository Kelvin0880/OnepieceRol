// Test helper: sets a character's current life, to drive the hit/low-life interface effects deterministically.
// Usage: npx tsx scripts/set-character-hp.ts <characterId> <hp>
import { prisma } from "../src/lib/db";

async function main() {
  const [id, hpArg] = process.argv.slice(2);
  const hp = Number(hpArg);
  if (!id || !Number.isFinite(hp)) throw new Error("Usage: set-character-hp.ts <characterId> <hp>");
  await prisma.character.update({ where: { id }, data: { hp } });
  console.log("hp", id, hp);
}

main().finally(() => prisma.$disconnect());
