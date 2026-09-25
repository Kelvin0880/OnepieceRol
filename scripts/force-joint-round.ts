// Ops helper: re-judges the current round of a stalled joint fight (everyone answered, the referee failed).
// Usage: DATABASE_URL=<prod> npx tsx scripts/force-joint-round.ts <character name>
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getOpenJointFightFor, forceResolveJointRound } from "../src/lib/game/joint-fight";

async function main() {
  const c = await prisma.character.findFirst({ where: { name: { contains: process.argv[2] ?? "" } } });
  if (!c) throw new Error("no such character");
  const fight = await getOpenJointFightFor(c.id);
  if (!fight) throw new Error("no open joint fight");
  const r = await forceResolveJointRound(fight.id);
  console.log(JSON.stringify(r).slice(0, 600));
}
main().finally(() => prisma.$disconnect());
