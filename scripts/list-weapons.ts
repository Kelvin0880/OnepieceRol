import { prisma } from "../src/lib/db";

async function main() {
  const weapons = await prisma.weapon.findMany({ select: { id: true, name: true, ownerId: true, grade: true } });
  console.log(JSON.stringify(weapons, null, 2));
}

main().finally(() => prisma.$disconnect());
