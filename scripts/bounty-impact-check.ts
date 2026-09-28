process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Pirate bounty in millions end to end on the dev DB: gains grow with fame, beating a canon character pays by who they
// are, and a Marine who wins the same fight gets the small notoriety scale. Usage: npx tsx scripts/bounty-impact-check.ts (freshly seeded DB)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { applyBountyOrNotoriety } from "../src/lib/game/reputation";
import { startJointFight, ownerSettleJointFight } from "../src/lib/game/joint-fight";
import { canonDefeatBounty } from "../src/lib/engine/bounty-impact";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function mk(stamp: number, tag: string, faction: "PIRATE" | "MARINE") {
  const u = await prisma.user.create({ data: { username: `bi${tag}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${tag}${stamp}`, faction, "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { level: 20, hp: 100, maxHp: 100 } });
  return prisma.character.findUniqueOrThrow({ where: { id: c.id } });
}

async function main() {
  const stamp = Date.now() % 100000;

  // Fame snowballs: the same nominal gain is worth more to a famous pirate.
  const rookie = await mk(stamp, "Novato", "PIRATE");
  const famous = await mk(stamp, "Famoso", "PIRATE");
  await prisma.character.update({ where: { id: famous.id }, data: { bounty: 250_000_000 } });
  const famousNow = await prisma.character.findUniqueOrThrow({ where: { id: famous.id } });
  const g1 = await applyBountyOrNotoriety(rookie, 10_000_000, []);
  const g2 = await applyBountyOrNotoriety(famousNow, 10_000_000, []);
  assert(g1 === 10_000_000, "a small poster gains exactly the nominal amount");
  assert(g2 === 20_000_000, "a 250M poster gains double for the same feat");
  const log = await prisma.bountyLogEntry.findFirstOrThrow({ where: { characterId: famous.id }, orderBy: { createdAt: "desc" } });
  assert(log.delta === 20_000_000, "the bounty ledger records the real gain");

  // Beating a canon character pays by who they are; a Marine gets the small scale.
  const shanks = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Shanks" } });
  const expected = canonDefeatBounty(shanks, "canon");
  assert(expected > 100_000_000, `beating Shanks is worth ${expected.toLocaleString("es-ES")} (well over 100M)`);
  const fight = async (who: { id: string }) => {
    await prisma.character.update({ where: { id: who.id }, data: { pendingEncounter: undefined } }).catch(() => undefined);
    const started = await startJointFight({
      kind: "canon",
      characterIds: [who.id],
      enemy: { name: "Shanks", hp: 200, atk: 60, def: 50, spd: 30, isBoss: true, level: 40, worldActorId: shanks.id, isActor: true },
      rewards: { berries: 1000, xp: 100, bounty: shanks.powerLevel * 250_000, pirateBounty: expected, islandDanger: 9 },
    });
    await ownerSettleJointFight(started.fightId, "victory");
  };
  const pirate = await mk(stamp, "Pirata", "PIRATE");
  await fight(pirate);
  const afterPirate = await prisma.character.findUniqueOrThrow({ where: { id: pirate.id } });
  assert(afterPirate.bounty >= expected && afterPirate.bounty < expected * 3, `the pirate's bounty jumped by the canon amount (${afterPirate.bounty.toLocaleString("es-ES")})`);
  const marine = await mk(stamp, "Marino", "MARINE");
  await fight(marine);
  const afterMarine = await prisma.character.findUniqueOrThrow({ where: { id: marine.id } });
  assert(afterMarine.notoriety > 0 && afterMarine.notoriety < 20_000, `a Marine gets the small notoriety scale (${afterMarine.notoriety})`);

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
