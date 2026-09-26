// Test helper for route-path-ui-check.mjs: forces a canon REVOLUTION war (deterministic, not left to the seeded RNG)
// so the browser check can see "Guerras del mundo" and the enlist button without waiting on the real 4-day cadence.
// Usage: npx tsx scripts/world-wars-setup.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  await prisma.war.deleteMany({ where: { attackerKind: "canon" } });
  // A MARINE-kind war (a Yonko vs. the Marines) is the one kind a PIRATE player can freely enlist in as attacker.
  const yonko = await prisma.worldActor.findFirstOrThrow({ where: { role: "YONKO", status: "ACTIVE" } });
  const war = await prisma.war.create({
    data: { kind: "MARINE", attackerKind: "canon", defenderKind: "canon", attackerId: yonko.id, attackerName: yonko.name, defenderName: "la Marina", nextFrontAt: new Date(Date.now() + 3600_000), logJson: JSON.stringify([`${yonko.name} declara la guerra a la Marina.`]) },
  });
  console.log(`war ${war.id}: ${war.attackerName} vs ${war.defenderName}`);
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
