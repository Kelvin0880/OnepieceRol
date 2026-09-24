// Test helper: prints the seeded max HP of a template's enemy. Usage: npx tsx scripts/print-seeded-hp.ts "<event title>"
import { prisma } from "../src/lib/db";
async function main() {
  const t = await prisma.eventTemplate.findFirstOrThrow({ where: { title: process.argv[2] } });
  console.log(JSON.parse(t.bodyJson).enemy.hp);
}
main().finally(() => prisma.$disconnect());
