// Final raid end to end (2026-09-24): Laugh Tale reveal, gating, allies by standing,
// four phases as joint fights, the Pirate King vote and the new era.
// Direct calls against the dev DB; moves are classified by the real AI.
// Usage: npx tsx scripts/raid-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { musterRaid, pledgeAlly, launchRaidPhase, castRaidVote, getRaidState, RaidError } from "../src/lib/game/raid";
import { addStanding } from "../src/lib/game/alliance";
import { submitJointAction, getOpenJointFightFor } from "../src/lib/game/joint-fight";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function mk(tag: string, islandId: string, knows: boolean) {
  const u = await prisma.user.create({ data: { username: `rd${tag}${Date.now() % 1_000_000}`, passwordHash: "x" } });
  return prisma.character.create({
    data: { name: `${tag}${Date.now() % 100000}`, faction: "PIRATE", userId: u.id, currentIslandId: islandId, strength: 2000, agility: 2000, durability: 2000, hp: 9000, maxHp: 9000, level: 50, knowsTruth: knows },
  });
}

async function fightThrough(chars: { id: string; userId: string }[]) {
  for (let i = 0; i < 14; i++) {
    const open = await getOpenJointFightFor(chars[0].id);
    if (!open) return;
    for (const c of chars) {
      const p = await prisma.jointFightParticipant.findFirst({ where: { fightId: open.id, characterId: c.id } });
      if (p?.status === "FIGHTING" && !p.action) await submitJointAction(c.id, c.userId, "Cargo contra el enemigo con todo lo que tengo.");
    }
  }
}

async function refuses(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof RaidError;
  }
}

async function main() {
  const mary = await prisma.island.findFirstOrThrow({ where: { name: "Mary Geoise" } });
  await prisma.raid.deleteMany({});
  const ruler = await prisma.worldActor.findFirst({ where: { role: "HIDDEN_RULER" } });
  assert(!!ruler && ruler.name === "El Rey Sin Nombre", "the hidden ruler exists as a WorldActor");

  const a = await mk("Lider", mary.id, true);
  const b = await mk("Socio", mary.id, true);
  const outsider = await mk("Ajeno", mary.id, false);

  assert(await refuses(() => musterRaid(outsider.id, outsider.userId, true)), "someone who never saw Laugh Tale cannot join");
  await musterRaid(a.id, a.userId, true);
  await musterRaid(b.id, b.userId, true);
  let st = await getRaidState(a.id);
  assert(st!.muster.length === 2 && st!.iAmLeader, "coalition of two, first is leader");
  assert(await refuses(() => launchRaidPhase(b.id, b.userId)), "only the leader launches");

  const ally = await prisma.worldActor.findFirstOrThrow({ where: { name: "Shanks" } });
  assert(await refuses(() => pledgeAlly(a.id, a.userId, ally.id)), "an actor with no standing cannot be pledged");
  await addStanding(ally.id, a.id, { mission: 3 }, "test");
  await addStanding(ally.id, a.id, { mission: 3 }, "test");
  await addStanding(ally.id, a.id, { mission: 3 }, "test");
  await pledgeAlly(a.id, a.userId, ally.id);
  st = await getRaidState(a.id);
  assert(st!.allies.length === 1, "a trusted actor joins the coalition");

  const players = [a, b];
  for (let phase = 1; phase <= 4; phase++) {
    st = await getRaidState(a.id);
    assert(st!.phase === phase && st!.status === "MUSTERING", `phase ${phase} ready`);
    await launchRaidPhase(a.id, a.userId);
    const fight = await getOpenJointFightFor(a.id);
    assert(!!fight && fight.kind === "raid", `phase ${phase}: a raid fight opens`);
    assert(JSON.parse(fight!.contextJson).maxEnemyAttacks === 6, "raid enemy gets its higher attack ceiling");
    if (phase === 1) {
      const parts = await prisma.jointFightParticipant.findMany({ where: { fightId: fight!.id } });
      assert(parts.some((p) => p.characterId === `npc:ally:${ally.id}` && !!p.npcStatsJson), "the pledged actor fights as an NPC ally");
    }
    await fightThrough(players);
    const raid = await prisma.raid.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    if (raid.status === "LOST") {
      console.log("Raid lost in phase " + phase + " (random); rerun the check.");
      return;
    }
  }

  st = await getRaidState(a.id);
  assert(st!.status === "CLAIM_VOTE" && !!st!.voting, "after the ruler falls a Pirate King vote opens");
  assert(await refuses(() => castRaidVote(outsider.id, outsider.userId, a.id)), "non-participants cannot vote");
  await castRaidVote(a.id, a.userId, a.id);
  await castRaidVote(b.id, b.userId, a.id);
  const done = await prisma.raid.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  assert(done.status === "WON", "unanimous vote resolves the raid");
  const king = await prisma.character.findUniqueOrThrow({ where: { id: a.id } });
  const mate = await prisma.character.findUniqueOrThrow({ where: { id: b.id } });
  assert(king.title === "Rey de los Piratas" && mate.title === "Héroe de Mary Geoise", "king crowned, partner honoured");
  const clock = await prisma.worldClock.findUniqueOrThrow({ where: { id: 1 } });
  assert(clock.era === "Nueva Era", "the world enters the New Era");
  assert(await refuses(() => musterRaid(a.id, a.userId, true)), "a week-long cooldown follows the victory");
  console.log("ALL RAID CHECKS PASSED");
}

main().finally(() => prisma.$disconnect());
