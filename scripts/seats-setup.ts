process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Test helper for seats-ui-check.mjs. Usage: npx tsx scripts/seats-setup.ts stage|win|challenged <characterName>
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { closeJointFight, getOpenJointFightFor } from "../src/lib/game/joint-fight";
import { startCanonSeatEventNow } from "../src/lib/game/faction-seats";

async function main() {
  const [mode, name] = process.argv.slice(2);
  const c = await prisma.character.findFirstOrThrow({ where: { name } });
  if (mode === "stage") {
    const island = await prisma.island.findUniqueOrThrow({ where: { name: "Nuevo Marineford" } });
    await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: island.id, level: 55, hp: 900, maxHp: 900, maxStamina: 400, stamina: 400, notoriety: 8_000 } });
  } else if (mode === "win") {
    const open = await getOpenJointFightFor(c.id);
    if (!open) throw new Error("no open fight");
    await prisma.jointFight.update({ where: { id: open.id }, data: { enemyHp: 10 } });
    await closeJointFight(c.id, c.userId);
  } else if (mode === "challenged") {
    // The world comes for this player's seat right now.
    await prisma.character.updateMany({ where: { seat: { not: null }, id: { not: c.id } }, data: { lastSeatDefenseAt: new Date() } });
    await prisma.character.update({ where: { id: c.id }, data: { seatSince: new Date(Date.now() - 48 * 3600_000), lastSeatDefenseAt: null } });
    await startCanonSeatEventNow();
  }
  console.log("ok");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
