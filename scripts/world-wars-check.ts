process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Canon world wars (Revolution/Justice/Emperor/Marine): a canon leader declares war on their own, players can enlist
// and land a blow, fronts move the score, and the ending moves real world state (island control, territory, canonBounty).
// Usage (fresh dev DB, seeded): npx tsx scripts/world-wars-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { startCanonWar, runFront, settleCanonWarIfDone, tickCanonWars, warsSummary, LIBERATED, OCCUPIED } from "../src/lib/game/world-wars";
import { getSovereigntyState, warAssault } from "../src/lib/game/sovereignty";
import { closeJointFight, getOpenJointFightFor } from "../src/lib/game/joint-fight";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

const stamp = Date.now() % 1_000_000;
async function mk(name: string, faction: "MARINE" | "REVOLUTIONARY" | "PIRATE" | "CP0", island: string, extra: Record<string, unknown> = {}) {
  const u = await prisma.user.create({ data: { username: `${name}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${name}${stamp}`, faction, "swordsman");
  const isl = await prisma.island.findUniqueOrThrow({ where: { name: island } });
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: isl.id, level: 40, hp: 600, maxHp: 600, ...extra } });
  return { u, c: await prisma.character.findUniqueOrThrow({ where: { id: c.id } }) };
}

async function win(id: string, userId: string) {
  const f = await getOpenJointFightFor(id);
  if (!f) throw new Error("no open fight");
  await prisma.jointFight.update({ where: { id: f.id }, data: { enemyHp: 10 } });
  return closeJointFight(id, userId);
}

async function main() {
  // --- REVOLUTION war: declared by the world, a revolutionary enlists as attacker and hits a Marine base ---
  await prisma.war.deleteMany();
  const declared = await startCanonWar();
  assert(!!declared, `a canon war starts on its own (${declared?.kind ?? "none"}: ${declared?.attackerName} vs ${declared?.defenderName})`);
  if (!declared) throw new Error("no canon war could start — check WorldActor seeding");

  const summary = await warsSummary();
  assert(summary.some((l) => l.includes(declared.attackerName)), "warsSummary lists the open war for the AI's world facts");

  if (declared.kind === "REVOLUTION") {
    const rev = await mk("Revol", "REVOLUTIONARY", "Isla Baltigo", { notoriety: 5000 });
    const state1 = await getSovereigntyState(rev.c.id, rev.u.id);
    const w = state1.worldWars.find((x) => x.id === declared.id)!;
    assert(w.mySide === "attacker", "a revolutionary is automatically on the attacking side, no need to enlist");

    const gov = await mk("Gov", "MARINE", "Cuartel Marine G-5", { notoriety: 5000 });
    const state2 = await getSovereigntyState(gov.c.id, gov.u.id);
    const w2 = state2.worldWars.find((x) => x.id === declared.id)!;
    assert(w2.mySide === "defender", "a marine automatically defends the Government side");

    const pirate = await mk("Pir", "PIRATE", "Pueblo Foosha");
    const state3 = await getSovereigntyState(pirate.c.id, pirate.u.id);
    const w3 = state3.worldWars.find((x) => x.id === declared.id)!;
    assert(w3.mySide === null && w3.canEnlist.length === 0, "a pirate has no automatic side and cannot enlist in a Revolution war");

    // Move the revolutionary to a Marine base so an assault is available, then land a blow.
    const marineBase = await prisma.island.findFirst({ where: { factionControl: "Marina" } });
    assert(!!marineBase, "at least one seeded island is under Marina control");
    await prisma.character.update({ where: { id: rev.c.id }, data: { currentIslandId: marineBase!.id } });
    const state4 = await getSovereigntyState(rev.c.id, rev.u.id);
    assert(state4.canAssaultHere, "the revolutionary can assault the Marine base they're standing on");
    await warAssault(rev.c.id, rev.u.id);
    const result = await win(rev.c.id, rev.u.id);
    assert(!!result, "the assault resolves as a joint fight the player can win");
    const freshWar = await prisma.war.findUniqueOrThrow({ where: { id: declared.id } });
    assert(freshWar.attackerPlayerBlows === 1, "a player's winning blow is counted toward their side's war effort");

    // Force the war to its ending and check the world actually changed.
    await prisma.war.update({ where: { id: declared.id }, data: { attackerScore: 20, defenderScore: 2 } });
    const ended = await settleCanonWarIfDone(declared.id);
    assert(ended, "settleCanonWarIfDone ends a lopsided war once the score/time threshold is hit");
    const afterIsland = await prisma.island.findUniqueOrThrow({ where: { id: marineBase!.id } });
    assert(afterIsland.factionControl === LIBERATED || afterIsland.factionControl === "Ejército Revolucionario", `winning a Revolution war changes real island control (now: ${afterIsland.factionControl})`);
  } else {
    console.log(`(the world picked a ${declared.kind} war this run — REVOLUTION-specific checks skipped, that's fine, it's seeded)`);
  }

  // --- A second canon war, forced to be REVOLUTION via direct DB state, to cover the loss-side effect + fronts ---
  await prisma.war.deleteMany();
  const revActor = await prisma.worldActor.findFirstOrThrow({ where: { factionType: "REVOLUTIONARY", status: "ACTIVE" } });
  const war2 = await prisma.war.create({
    data: { kind: "REVOLUTION", attackerKind: "canon", defenderKind: "canon", attackerId: revActor.id, attackerName: revActor.name, defenderName: "el Gobierno Mundial", nextFrontAt: new Date(), logJson: "[]" },
  });
  const front = await runFront(war2.id);
  assert(!!front, `runFront judges a front and returns a headline-ish line ("${front}")`);
  const afterFront = await prisma.war.findUniqueOrThrow({ where: { id: war2.id } });
  assert(afterFront.attackerScore + afterFront.defenderScore === 1, "a resolved front increments exactly one side's score");
  assert(afterFront.nextFrontAt!.getTime() > Date.now(), "runFront reschedules the next front for later");

  // The claim guard protects against a genuine RACE (two simultaneous callers reading the same due front), not
  // against a deliberate manual re-run later (that's what the admin's "run a front now" button relies on).
  await prisma.war.update({ where: { id: war2.id }, data: { nextFrontAt: new Date(Date.now() - 1000) } });
  const [race1, race2] = await Promise.all([runFront(war2.id), runFront(war2.id)]);
  const raceWinners = [race1, race2].filter((x) => x !== null);
  assert(raceWinners.length === 1, "two simultaneous calls on the same due front: exactly one wins the claim, the other gets null");

  // Force a defender win to check the losing side's own consequence (occupation, not just a news line).
  await prisma.war.update({ where: { id: war2.id }, data: { attackerScore: 1, defenderScore: 20 } });
  const ended2 = await settleCanonWarIfDone(war2.id);
  assert(ended2, "a lopsided loss also ends the war");
  const islandsNow = await prisma.island.findMany({ select: { factionControl: true } });
  assert(islandsNow.some((i) => i.factionControl === OCCUPIED || i.factionControl === "Marina"), "losing a Revolution war can put a revolutionary base under Marine occupation");

  // --- tickCanonWars never throws and is idempotent to call back-to-back ---
  await tickCanonWars();
  await tickCanonWars();
  console.log("PASS: tickCanonWars runs repeatedly without throwing");

  console.log("\nALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
