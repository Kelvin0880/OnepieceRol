// One-off: island missions now pay 2.5x XP; raise the active ones already handed out (run once). Usage: npx tsx scripts/boost-active-missions.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { MISSION_XP_BOOST } from "../src/lib/engine/missions";

async function main() {
  const active = await prisma.mission.findMany({ where: { status: "ACTIVE" } });
  for (const m of active) await prisma.mission.update({ where: { id: m.id }, data: { xp: Math.round(m.xp * MISSION_XP_BOOST) } });
  console.log("boosted", active.length);
}
main().finally(() => prisma.$disconnect());
