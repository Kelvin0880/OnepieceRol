import { prisma } from "../src/lib/db";

async function main() {
  const id = process.argv[2];
  const c = await prisma.character.findUnique({ where: { id }, include: { user: true } });
  console.log(JSON.stringify(c, null, 2));
}

main().finally(() => prisma.$disconnect());
