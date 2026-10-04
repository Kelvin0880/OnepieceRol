// Test helper for warlord-call-ui-check.mjs: makes a character a Shichibukai and opens a canon Emperor-vs-Marines war.
// Usage: npx tsx scripts/warlord-call-setup.ts <characterId>
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Usage: warlord-call-setup.ts <characterId>");
  await prisma.war.deleteMany({ where: { attackerKind: "canon" } });
  await prisma.character.update({ where: { id }, data: { warlordSince: new Date(), warlordTributeDueAt: new Date(Date.now() + 5 * 86400_000), bounty: 200_000_000, level: 25 } });
  const yonko = await prisma.worldActor.findFirstOrThrow({ where: { role: "YONKO", status: "ACTIVE" } });
  await prisma.war.create({
    data: { kind: "MARINE", attackerKind: "canon", defenderKind: "canon", attackerId: yonko.id, attackerName: yonko.name, defenderName: "la Marina", nextFrontAt: new Date(Date.now() + 3600_000), logJson: "[]" },
  });
  console.log(JSON.stringify({ attacker: yonko.name }));
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
