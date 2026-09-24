// Test helper: npx tsx scripts/set-reputation.ts "<character name>" <bounty> <notoriety>
import { prisma } from "../src/lib/db";
async function main() {
  const r = await prisma.character.updateMany({ where: { name: process.argv[2] }, data: { bounty: Number(process.argv[3]), notoriety: Number(process.argv[4] ?? 0) } });
  console.log(`updated ${r.count} character(s)`);
}
main().finally(() => prisma.$disconnect());
