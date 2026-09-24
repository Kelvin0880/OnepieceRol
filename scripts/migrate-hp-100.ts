// One-off, idempotent: raises every character/companion whose maxHp is below the new base (100 / 60)
// while keeping the same fraction of health. Run against local dev, then against Neon (DATABASE_URL).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const chars = await prisma.character.findMany({ where: { maxHp: { lt: 100 } }, select: { id: true, name: true, hp: true, maxHp: true } });
  for (const c of chars) {
    const hp = Math.max(1, Math.round((c.hp * 100) / c.maxHp));
    await prisma.character.update({ where: { id: c.id }, data: { maxHp: 100, hp: c.hp <= 0 ? 0 : Math.min(100, hp) } });
    console.log(`character ${c.name}: ${c.hp}/${c.maxHp} -> ${Math.min(100, hp)}/100`);
  }
  const comps = await prisma.nPCCompanion.findMany({ where: { maxHp: { lt: 60 } }, select: { id: true, name: true, hp: true, maxHp: true } });
  for (const n of comps) {
    const hp = Math.max(1, Math.round((n.hp * 60) / n.maxHp));
    await prisma.nPCCompanion.update({ where: { id: n.id }, data: { maxHp: 60, hp: n.hp <= 0 ? 0 : Math.min(60, hp) } });
  }
  console.log(`migrated ${chars.length} characters, ${comps.length} companions`);
}
main().finally(() => prisma.$disconnect());
