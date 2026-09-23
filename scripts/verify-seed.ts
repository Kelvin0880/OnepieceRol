import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Islands:", await prisma.island.count());
  console.log("Fruits:", await prisma.devilFruit.count());
  console.log("Weapons:", await prisma.weapon.count());
  console.log("WorldActors:", await prisma.worldActor.count());
  console.log("WorldEventTemplates:", await prisma.worldEventTemplate.count());
  console.log("EventTemplates:", await prisma.eventTemplate.count());
  console.log("Poneglyphs:", await prisma.poneglyph.count());
}

main().finally(() => prisma.$disconnect());
