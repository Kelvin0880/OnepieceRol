import "dotenv/config";
import { prisma } from "../src/lib/db";
(async () => {
  const cs = await prisma.character.findMany({ where: { faction: "MARINE", status: "ALIVE" }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, level: true, notoriety: true, hp: true, maxHp: true, berries: true, createdAt: true, devilFruitId: true, fruitMastery: true, fruitAwakened: true, seat: true, title: true, userId: true, maxStamina: true, strength: true, agility: true, durability: true, willpower: true, intellect: true, armamentHaki: true, observationHaki: true, conquerorsHaki: true, currentIsland: { select: { name: true } } } });
  console.log(cs);
})().finally(() => prisma.$disconnect());
