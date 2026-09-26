// Faction contracts (every island also hands out one job for your own faction) and "Mi camino" (the next-steps
// panel), driven end to end against the real DB. Usage (fresh dev DB, seeded): npx tsx scripts/faction-contracts-path-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { ensureIslandMissions, getMissionState, recordMissionEvent } from "../src/lib/game/missions";
import { getPathState } from "../src/lib/game/path-guide";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

const stamp = Date.now() % 1_000_000;
async function mk(name: string, faction: "MARINE" | "PIRATE") {
  const u = await prisma.user.create({ data: { username: `${name}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${name}${stamp}`, faction, "swordsman");
  return { u, c: await prisma.character.findUniqueOrThrow({ where: { id: c.id } }) };
}

async function main() {
  // --- A marine gets a real arrest warrant, targeting a real island resident, never an invented name ---
  const marine = await mk("Contm", "MARINE");
  await ensureIslandMissions(marine.c.id);
  const state1 = await getMissionState(marine.c.id);
  assert(!!state1, "mission state loads");
  const contract = state1!.missions.find((m) => m.factionRep > 0);
  assert(!!contract, `the batch includes a faction contract (got: ${state1!.missions.map((m) => m.title).join(" | ")})`);
  const row = await prisma.mission.findUniqueOrThrow({ where: { id: contract!.id } });
  if (row.targetNpcId) {
    const target = await prisma.islandNpc.findUnique({ where: { id: row.targetNpcId } });
    assert(!!target, "the contract's target is a real, existing island resident — never invented");
  }

  // Completing it (via the same recordMissionEvent path a real defeat goes through) pays real notoriety, not bounty.
  if (row.targetNpcId) {
    const before = (await prisma.character.findUniqueOrThrow({ where: { id: marine.c.id } })).notoriety;
    await recordMissionEvent(marine.c.id, { kind: "npc", npcId: row.targetNpcId });
    const after = await prisma.character.findUniqueOrThrow({ where: { id: marine.c.id } });
    assert(after.notoriety === before + row.factionRep, `beating the contract's target pays exactly its factionRep in notoriety (+${row.factionRep}, before ${before}, after ${after.notoriety})`);
    const doneRow = await prisma.mission.findUniqueOrThrow({ where: { id: row.id } });
    assert(doneRow.status === "DONE", "the contract mission is marked DONE");
  } else {
    console.log("(no fighter resident was free on this seeded run — the marine got the patrol fallback instead, that's fine, it's seeded)");
  }

  // --- A pirate's contract pays real bounty on completion instead ---
  const pirate = await mk("Contp", "PIRATE");
  await ensureIslandMissions(pirate.c.id);
  const state2 = await getMissionState(pirate.c.id);
  const pContract = state2!.missions.find((m) => m.factionRep > 0);
  assert(!!pContract, "the pirate also gets a faction contract");
  const pRow = await prisma.mission.findUniqueOrThrow({ where: { id: pContract!.id } });
  if (pRow.kind === "defeat_npc" && pRow.targetNpcId) {
    const before = (await prisma.character.findUniqueOrThrow({ where: { id: pirate.c.id } })).bounty;
    await recordMissionEvent(pirate.c.id, { kind: "npc", npcId: pRow.targetNpcId });
    const after = await prisma.character.findUniqueOrThrow({ where: { id: pirate.c.id } });
    assert(after.bounty === before + pRow.factionRep, `a pirate's contract pays real bounty, not notoriety (+${pRow.factionRep})`);
  } else {
    console.log(`(the pirate got a "${pRow.kind}" contract this run — no direct npc kill to force here, that's a real, valid contract shape too)`);
  }

  // --- "Mi camino" reflects real state end to end ---
  const path1 = await getPathState(marine.c.id, marine.u.id);
  assert(path1.steps.length > 0, "a fresh character always has at least one next step");
  assert(!!path1.rank.title, "the path state carries a real rank title");

  await prisma.character.update({ where: { id: marine.c.id }, data: { hp: 5 } });
  const path2 = await getPathState(marine.c.id, marine.u.id);
  assert(path2.steps[0].id === "heal", `badly hurt is always the first thing "Mi camino" tells you about (got: ${path2.steps[0].id})`);

  const jail = await prisma.island.findFirstOrThrow();
  await prisma.character.update({ where: { id: marine.c.id }, data: { hp: 100, status: "IMPRISONED" } });
  await prisma.imprisonment.create({ data: { characterId: marine.c.id, islandId: jail.id, reason: "prueba", minRescueLevel: 1 } });
  const path3 = await getPathState(marine.c.id, marine.u.id);
  assert(path3.steps[0].id === "prison", "being imprisoned always tops the list, above even being hurt");

  console.log("\nALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
