import { prisma } from "../src/lib/db";

async function main() {
  const id = process.argv[2];
  const c = await prisma.character.findUnique({ where: { id }, include: { imprisonment: true } });
  console.log("status:", c?.status, "berries:", c?.berries, "imprisonment:", c?.imprisonment);
}

main().finally(() => prisma.$disconnect());
