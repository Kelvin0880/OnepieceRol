// Test helper: forces a character straight into the "threat" phase of a
// PendingEncounter against a moderately tough enemy (enough HP to take
// several exchanges), bypassing exploration RNG, so round-by-round combat
// can be verified deterministically instead of waiting on random events.
// Usage: npx tsx scripts/force-threat-encounter.ts <characterId>
import { prisma } from "../src/lib/db";

async function main() {
  const [characterId] = process.argv.slice(2);
  if (!characterId) throw new Error("Usage: force-threat-encounter.ts <characterId>");

  const enemy = { name: "Bandido de poca monta", hp: 25, atk: 8, def: 4, spd: 5, isBoss: false, personality: "torpe pero terco, no sabe cuándo rendirse" };

  await prisma.pendingEncounter.deleteMany({ where: { characterId } });
  await prisma.pendingEncounter.create({
    data: {
      characterId,
      enemyJson: JSON.stringify(enemy),
      rewardsJson: JSON.stringify({ berries: 100, xp: 20, bounty: 0, islandDanger: 1 }),
      narrative: "[forced for testing]",
      assessment: "weaker",
      phase: "threat",
    },
  });
  console.log("Forced threat-phase PendingEncounter for", characterId, "against", enemy);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
