// Read-only: dumps the latest joint fight of characters whose name contains the given text. Usage: npx tsx scripts/dump-joint.ts Barbosa
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const q = process.argv[2] ?? "";
  const chars = await prisma.character.findMany({ where: { name: { contains: q } }, select: { id: true } });
  const parts = await prisma.jointFightParticipant.findMany({ where: { characterId: { in: chars.map((c) => c.id) } }, select: { fightId: true } });
  const fights = await prisma.jointFight.findMany({ where: { id: { in: parts.map((p) => p.fightId) } }, orderBy: { updatedAt: "desc" }, take: 1, include: { participants: true, messages: { orderBy: { createdAt: "asc" } } } });
  for (const f of fights) {
    const e = JSON.parse(f.enemyJson);
    console.log(`=== ${f.id} ${f.status} ronda ${f.round} kind=${f.kind} enemigo=${e.name} vida ${f.enemyHp}/${f.enemyMaxHp}`);
    for (const p of f.participants) console.log(`  ${p.name} hp ${p.hp}/${p.maxHp} ${p.status} npc=${p.isNpc} accion=${JSON.stringify(p.action)}`);
    for (const m of f.messages) console.log(`\n[${m.createdAt.toISOString().slice(11, 19)}] ${m.authorName}: ${m.text}`);
  }
}
main().finally(() => prisma.$disconnect());
