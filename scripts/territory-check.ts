process.env.REFEREE_STUB = "1"; // combat is judged by the AI; scripted checks use the deterministic stand-in
// Territory conquest end to end (2026-09-24): army -> commanders -> holder, a
// weighted claim vote between two contributors, income, garrison decay and the
// old power retaking the island. Direct calls against the dev DB; each move is
// classified by the real AI. Usage: npx tsx scripts/territory-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { musterForConquest, assaultTerritory, castVote, collectIncome, fortifyTerritory, getTerritoryState, refreshTerritory, TerritoryError } from "../src/lib/game/territory";
import { submitJointAction, getOpenJointFightFor } from "../src/lib/game/joint-fight";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function mk(tag: string, islandId: string, boost: number, crewId?: string) {
  const u = await prisma.user.create({ data: { username: `tr${tag}${Date.now() % 1_000_000}`, passwordHash: "x" } });
  return prisma.character.create({
    data: { name: `${tag}${Date.now() % 100000}`, faction: "PIRATE", userId: u.id, currentIslandId: islandId, strength: boost, agility: boost, durability: boost, hp: 500, maxHp: 500, level: 20, berries: 10_000_000, crewId },
  });
}

async function fightThrough(chars: { id: string; userId: string }[]) {
  for (let i = 0; i < 12; i++) {
    const open = await getOpenJointFightFor(chars[0].id);
    if (!open) return;
    for (const c of chars) {
      const p = await prisma.jointFightParticipant.findFirst({ where: { fightId: open.id, characterId: c.id } });
      if (p?.status === "FIGHTING" && !p.action) await submitJointAction(c.id, c.userId, "Ataco con todo, coordinado con mi aliado.");
    }
  }
}

async function main() {
  const island = await prisma.island.findUniqueOrThrow({ where: { name: "Whisky Peak" } });
  const t0 = await prisma.territory.findUniqueOrThrow({ where: { islandId: island.id } });
  assert(t0.status === "HELD" && !!t0.ownerActorId && !t0.ownerCharacterId, "Whisky Peak starts held by its canon power");
  // Clean slate from any earlier run.
  await prisma.territory.update({ where: { id: t0.id }, data: { status: "HELD", stage: "ARMY", ownerActorId: t0.homeActorId, ownerCharacterId: null, ownerCrewId: null, contributionsJson: "{}", votesJson: "{}", musterJson: "[]", garrison: 100, lastPressureAt: new Date() } });
  await prisma.worldActor.update({ where: { id: t0.homeActorId! }, data: { busyUntil: null } });

  const strong = await mk("Fuerte", island.id, 900);
  const helper = await mk("Ayuda", island.id, 900);

  let refused = false;
  try {
    await musterForConquest(strong.id, strong.userId, true);
    await prisma.territory.update({ where: { id: t0.id }, data: { ownerCharacterId: "someone" } });
    await assaultTerritory(strong.id, strong.userId);
  } catch (e) {
    refused = e instanceof TerritoryError;
  }
  await prisma.territory.update({ where: { id: t0.id }, data: { ownerCharacterId: null, musterJson: "[]" } });
  assert(refused, "a player-held island cannot be assaulted");

  // --- Stage 1..3 ---
  await musterForConquest(strong.id, strong.userId, true);
  await musterForConquest(helper.id, helper.userId, true);
  let state = await getTerritoryState(strong.id);
  assert(state!.muster.length === 2, "two players mustered");

  const players = [strong, helper];
  for (const stage of ["ARMY", "COMMANDERS", "HOLDER"]) {
    const before = await prisma.territory.findUniqueOrThrow({ where: { id: t0.id } });
    if (stage !== "ARMY") assert(before.stage === stage, `conquest advanced to ${stage}`);
    await musterForConquest(strong.id, strong.userId, true);
    await musterForConquest(helper.id, helper.userId, true);
    await assaultTerritory(strong.id, strong.userId);
    const fight = await getOpenJointFightFor(strong.id);
    assert(!!fight && fight.kind === "conquest", `${stage}: a conquest fight opens for the mustered players`);
    await fightThrough(players);
    const after = await prisma.territory.findUniqueOrThrow({ where: { id: t0.id } });
    if (stage !== "HOLDER") assert(after.status === "CONQUEST" && after.stage !== stage, `${stage} broken, conquest moves on`);
    if (stage === "HOLDER") assert(after.status === "CLAIM_VOTE", "holder fell: island is up for a claim vote");
  }

  // --- Dispute: two contributors, weighted vote ---
  const claim = await prisma.territory.findUniqueOrThrow({ where: { id: t0.id } });
  const contributions = JSON.parse(claim.contributionsJson) as Record<string, number>;
  assert(contributions[strong.id] > 0 && contributions[helper.id] > 0, "both fighters earned contribution points");
  let outsider = false;
  try {
    const rando = await mk("Ajeno", island.id, 5);
    await castVote(rando.id, rando.userId, strong.id);
  } catch (e) {
    outsider = e instanceof TerritoryError;
  }
  assert(outsider, "only contributors can vote");
  await castVote(strong.id, strong.userId, helper.id);
  let s = await getTerritoryState(strong.id);
  assert(s!.status === "CLAIM_VOTE", "vote stays open until everyone votes");
  await castVote(helper.id, helper.userId, helper.id);
  s = await getTerritoryState(strong.id);
  const winnerId = helper.id;
  assert(s!.status === "HELD" && s!.heldByPlayers, "with all votes in, the claim resolves");
  const owned = await prisma.territory.findUniqueOrThrow({ where: { id: t0.id } });
  assert(owned.ownerCharacterId === winnerId, "the voted claimant owns the island");
  const winnerChar = await prisma.character.findUniqueOrThrow({ where: { id: winnerId } });
  assert(!!winnerChar.title && winnerChar.title.includes("Whisky Peak"), `the owner earned a title (${winnerChar.title})`);
  assert((await prisma.newsItem.count({ where: { headline: { contains: "se proclama" } } })) > 0, "the claim made major news");

  // --- Income + fortify ---
  await prisma.territory.update({ where: { id: t0.id }, data: { lastIncomeAt: new Date(Date.now() - 5 * 3600_000) } });
  const berriesBefore = (await prisma.character.findUniqueOrThrow({ where: { id: winnerId } })).berries;
  await collectIncome(winnerId, helper.userId);
  assert((await prisma.character.findUniqueOrThrow({ where: { id: winnerId } })).berries > berriesBefore, "the owner collects tribute");
  let notOwner = false;
  try {
    await collectIncome(strong.id, strong.userId);
  } catch (e) {
    notOwner = e instanceof TerritoryError;
  }
  assert(notOwner, "only the owner collects tribute");

  // --- Neglect: garrison decays, old power retakes ---
  await prisma.territory.update({ where: { id: t0.id }, data: { lastPressureAt: new Date(Date.now() - 13 * 3600_000) } });
  let t = await refreshTerritory(await prisma.territory.findUniqueOrThrow({ where: { id: t0.id } }));
  assert(t.garrison === 75, `garrison decays 25 per 12h (${t.garrison})`);
  await fortifyTerritory(winnerId, helper.userId);
  t = await prisma.territory.findUniqueOrThrow({ where: { id: t0.id } });
  assert(t.garrison === 100, "fortifying restores the garrison");
  await prisma.territory.update({ where: { id: t0.id }, data: { lastPressureAt: new Date(Date.now() - 12 * 5 * 3600_000 - 1000) } });
  t = await refreshTerritory(await prisma.territory.findUniqueOrThrow({ where: { id: t0.id } }));
  assert(!t.ownerCharacterId && t.ownerActorId === t0.homeActorId, "a neglected island falls back to the old power");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: winnerId } })).title === null, "the old owner loses the title");

  // Leave the world as seeded.
  await prisma.worldActor.update({ where: { id: t0.homeActorId! }, data: { busyUntil: null, currentFocus: null } });
  console.log("ALL PASS");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
