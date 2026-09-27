// Ops helper (2026-09-27): print the exact per-round HP/stamina deltas a joint fight actually booked, straight from
// JointFightMessage.hpDeltaJson — ground truth instead of re-reading prose to guess who took what damage each round.
// Usage: npx tsx scripts/joint-fight-audit.ts <characterName>   (audits that character's current/most recent joint fight)
//        npx tsx scripts/joint-fight-audit.ts --fight <fightId>
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const arg = process.argv[2];
  if (!arg) throw new Error("Usage: joint-fight-audit.ts <characterName> | --fight <fightId>");

  let fightId: string;
  if (arg === "--fight") {
    fightId = process.argv[3];
    if (!fightId) throw new Error("Usage: joint-fight-audit.ts --fight <fightId>");
  } else {
    const c = await prisma.character.findFirstOrThrow({ where: { name: arg } });
    const part = await prisma.jointFightParticipant.findFirst({ where: { characterId: c.id }, orderBy: { joinedAt: "desc" } });
    if (!part) throw new Error(`${arg} has no joint fight participation on record.`);
    fightId = part.fightId;
  }

  const fight = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId } });
  console.log(`Fight ${fight.id} — kind ${fight.kind}, status ${fight.status}, round ${fight.round}, enemy ${fight.enemyHp}/${fight.enemyMaxHp}\n`);

  const msgs = await prisma.jointFightMessage.findMany({ where: { fightId, hpDeltaJson: { not: null } }, orderBy: { createdAt: "asc" } });
  if (msgs.length === 0) {
    console.log("No booked deltas found (fight predates this logging, or nothing has resolved yet).");
    return;
  }
  for (const [i, m] of msgs.entries()) {
    const delta = JSON.parse(m.hpDeltaJson!) as { name: string; hpBefore: number; hpAfter: number; lost: number; staminaLost: number }[];
    console.log(`Round ${i + 1} [${m.createdAt.toISOString()}]:`);
    for (const d of delta) console.log(`  ${d.name}: ${d.hpBefore} -> ${d.hpAfter} (lost ${d.lost} hp${d.staminaLost ? `, ${d.staminaLost} stamina` : ""})`);
    console.log();
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
