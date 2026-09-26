// Targeted, non-destructive update for a running world (never a full reseed): gives the canon holders their seat of
// command the first time and fixes three misleading rank labels. Idempotent. Usage: DATABASE_URL=... npx tsx scripts/seed-seats.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { assignCanonSeats } from "../src/lib/game/canon-seats";

const LABELS: Record<string, string> = {
  "Don Krieg": "Capitán pirata de la Armada Krieg",
  Orlumbus: "Capitán de la flota pirata Yonta Maria",
  Sengoku: "Ex-Almirante de Flota (retirado, inspector general)",
};

async function main() {
  for (const [name, rankLabel] of Object.entries(LABELS)) {
    const r = await prisma.worldActor.updateMany({ where: { name }, data: { rankLabel } });
    console.log(`label ${name}: ${r.count}`);
  }
  await prisma.worldActor.updateMany({
    where: { name: "Don Krieg" },
    data: { description: "Capitán pirata al mando de la Armada Krieg (se hace llamar «almirante» de su propia flota pirata; no tiene nada que ver con la Marina): arma lo que puede y avanza." },
  });
  console.log(`seats assigned: ${await assignCanonSeats(prisma as never)}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
