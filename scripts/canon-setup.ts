process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Test helper for canon-ui-check.mjs. Usage: npx tsx scripts/canon-setup.ts stage|win <characterName>
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { closeJointFight, getOpenJointFightFor } from "../src/lib/game/joint-fight";

async function main() {
  const [mode, name] = process.argv.slice(2);
  const c = await prisma.character.findFirstOrThrow({ where: { name } });
  if (mode === "stage") {
    const island = await prisma.island.findUniqueOrThrow({ where: { name: "Whole Cake Island" } });
    await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: island.id, level: 60, hp: 900, maxHp: 900, maxStamina: 400, stamina: 400 } });
    console.log("staged");
  } else if (mode === "win") {
    const open = await getOpenJointFightFor(c.id);
    if (!open) throw new Error("no open fight");
    await prisma.jointFight.update({ where: { id: open.id }, data: { enemyHp: 10 } });
    await prisma.jointFightMessage.create({ data: { fightId: open.id, authorCharacterId: null, authorName: "Narrador", text: "El rival cae de rodillas, vencido." } });
    const res = await closeJointFight(c.id, c.userId);
    console.log("won", res.outcome);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
