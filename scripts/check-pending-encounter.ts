// Test helper: prints the raw PendingEncounter state for ground truth (not just what the UI shows).
// Usage: npx tsx scripts/check-pending-encounter.ts <characterId>
import { prisma } from "../src/lib/db";

async function main() {
  const [characterId] = process.argv.slice(2);
  const pe = await prisma.pendingEncounter.findUnique({ where: { characterId } });
  console.log(pe ? `phase=${pe.phase} enemyHp=${pe.enemyHp} round=${pe.roundNumber}` : "phase=none");
}

main().finally(() => prisma.$disconnect());
