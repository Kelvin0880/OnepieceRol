// Test helper: npx tsx scripts/set-level.ts "<character name>" <level>
import { prisma } from "../src/lib/db";
async function main() {
  const [name, level] = [process.argv[2], Number(process.argv[3])];
  const r = await prisma.character.updateMany({ where: { name }, data: { level } });
  console.log(`set level ${level} on ${r.count} character(s) named ${name}`);
}
main().finally(() => prisma.$disconnect());
