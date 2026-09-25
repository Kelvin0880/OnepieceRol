// Read-only: dumps the latest duel(s) of characters whose name contains the given text. Usage: npx tsx scripts/dump-duel.ts Barbosa
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const q = process.argv[2] ?? "";
  const chars = await prisma.character.findMany({ where: { name: { contains: q } }, select: { id: true, name: true, level: true, hp: true, maxHp: true, stamina: true } });
  console.log("personajes:", JSON.stringify(chars));
  const ids = chars.map((c) => c.id);
  const duels = await prisma.duel.findMany({ where: { OR: [{ challengerId: { in: ids } }, { opponentId: { in: ids } }] }, orderBy: { updatedAt: "desc" }, take: 2, include: { messages: { orderBy: { createdAt: "asc" } } } });
  const name = async (id: string) => (await prisma.character.findUnique({ where: { id }, select: { name: true } }))?.name ?? id;
  for (const d of duels) {
    console.log(`\n=== duelo ${d.id} ${d.status} ronda ${d.round} lethal=${d.lethal} ${await name(d.challengerId)} ${d.challengerHp}/${d.challengerMaxHp} vs ${await name(d.opponentId)} ${d.opponentHp}/${d.opponentMaxHp} acciones pendientes: ${!!d.challengerAction}/${!!d.opponentAction}`);
    for (const m of d.messages) console.log(`[${m.createdAt.toISOString().slice(11, 19)}] ${m.authorName}: ${m.text}\n`);
  }
}
main().finally(() => prisma.$disconnect());
