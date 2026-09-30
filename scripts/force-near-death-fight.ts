// Test helper: puts a character mid-"fighting" against an enemy already critically low on HP (well below
// half life), so a single finishing free-text action exercises the exact real-world scenario that got stuck
// (Barbosa vs Novato Finn, 2026-09-30: the referee narrated the rival dead but never closed the fight).
// Usage: npx tsx scripts/force-near-death-fight.ts <characterId>
import { prisma } from "../src/lib/db";

async function main() {
  const [characterId] = process.argv.slice(2);
  if (!characterId) throw new Error("Usage: force-near-death-fight.ts <characterId>");

  const enemy = { name: "Bandido de poca monta", hp: 30, atk: 8, def: 4, spd: 5, isBoss: false, personality: "torpe pero terco, no sabe cuándo rendirse" };

  await prisma.pendingEncounter.deleteMany({ where: { characterId } });
  await prisma.pendingEncounter.create({
    data: {
      characterId,
      enemyJson: JSON.stringify(enemy),
      rewardsJson: JSON.stringify({ berries: 100, xp: 20, bounty: 0, islandDanger: 1 }),
      narrative: "[forced for testing]",
      assessment: "weaker",
      phase: "fighting",
      enemyHp: 6, // well under half of 30, matching the real fight right before it got stuck
      roundNumber: 3,
    },
  });
  console.log("Forced near-death fighting-phase PendingEncounter for", characterId, "against", enemy, "at 6/30 HP");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
