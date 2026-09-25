// Test helper for empire-check / empire-ui-check.
// `give "<character>"` makes them level 35 holder of the Black Bull island (garrison 40) with two nakamas;
// `expire "<character>"` makes every running errand finish now.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { readErrand, writeErrand } from "../src/lib/engine/empire";

async function main() {
  const [mode, name] = [process.argv[2], process.argv[3]];
  const c = await prisma.character.findFirstOrThrow({ where: { name } });
  if (mode === "give") {
    const toro = await prisma.island.findFirstOrThrow({ where: { name: "Isla del Toro Negro" } });
    await prisma.character.update({ where: { id: c.id }, data: { level: 35, hp: 200, maxHp: 200, currentIslandId: toro.id } });
    await prisma.territory.upsert({
      where: { islandId: toro.id },
      update: { ownerCharacterId: c.id, ownerName: c.name, status: "HELD", garrison: 40, lastPressureAt: new Date() },
      create: { islandId: toro.id, ownerCharacterId: c.id, ownerName: c.name, status: "HELD", garrison: 40 },
    });
    await prisma.nPCCompanion.deleteMany({ where: { characterId: c.id } });
    await prisma.nPCCompanion.create({ data: { characterId: c.id, name: "Yami Kessen", role: "Espadachín", hp: 150, maxHp: 150, loyalty: 90, profileJson: JSON.stringify({ epithet: "Corta-Tormentas", abilities: ["Tajo"], attrs: { strength: 90, agility: 60, durability: 70, willpower: 50, intellect: 30 } }) } });
    await prisma.nPCCompanion.create({ data: { characterId: c.id, name: "Jorge", role: "Cocinero", hp: 90, maxHp: 90, loyalty: 50 } });
  } else if (mode === "expire") {
    for (const n of await prisma.nPCCompanion.findMany({ where: { characterId: c.id } })) {
      const e = readErrand(n.profileJson);
      if (e) await prisma.nPCCompanion.update({ where: { id: n.id }, data: { profileJson: writeErrand(n.profileJson, { ...e, endsAt: Date.now() - 1000 }) } });
    }
  }
  console.log("ready");
}
main().finally(() => prisma.$disconnect());
