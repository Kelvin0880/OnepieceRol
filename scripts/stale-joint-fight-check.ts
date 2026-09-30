process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Real bug (Zarpe vs Crag el Rompehuesos, 2026-09-30): a canon_vanguard fight went stale (>24h unresolved) and
// getOpenJointFightFor's lazy cleanup cancelled it with a bare status update, never calling settleJointFight —
// so the linked CanonChallenge never learned the fight ended and stayed stuck in "VANGUARD" forever, permanently
// blocking any new challenge ("Ya tienes un desafío abierto."). This proves the fix: a stale fight now goes
// through the real settle path (outcome null), so whatever kind-specific hook was tracking it (here, canon) gets
// told and unblocks. Usage: npx tsx scripts/stale-joint-fight-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { getCanonHere, startCanonChallenge, CanonError } from "../src/lib/game/canon-encounter";
import { getOpenJointFightFor } from "../src/lib/game/joint-fight";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}
async function rejects(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof CanonError ? e.message : `UNEXPECTED ${(e as Error).message}`;
  }
}
async function mk(prefix: string, islandName: string, level: number) {
  const island = await prisma.island.findUniqueOrThrow({ where: { name: islandName } });
  const stamp = `${prefix}${Date.now() % 1000000}`;
  const u = await prisma.user.create({ data: { username: stamp, passwordHash: "x" } });
  const c = await createCharacter(u.id, stamp, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { level, currentIslandId: island.id, hp: 900, maxHp: 900, maxStamina: 400, stamina: 400 } });
  return { u, c, island };
}

async function main() {
  const a = await mk("stale", "Whole Cake Island", 60);
  const katakuri = await prisma.worldActor.findFirstOrThrow({ where: { name: "Charlotte Katakuri" } });
  const perospero = await prisma.worldActor.findFirstOrThrow({ where: { name: "Charlotte Perospero" } });

  await startCanonChallenge(a.c.id, a.u.id, katakuri.id);
  const ch = await prisma.canonChallenge.findFirstOrThrow({ where: { characterId: a.c.id } });
  const fight = await prisma.jointFight.findFirstOrThrow({ where: { kind: "canon_vanguard", participants: { some: { characterId: a.c.id } } } });
  assert(ch.stage === "VANGUARD" && fight.status === "ACTIVE", "a fresh challenge opens a real, active vanguard fight");

  // Simulate the fight going stale (>24h untouched). updatedAt is @updatedAt-managed, so backdate it with raw SQL.
  await prisma.$executeRawUnsafe(`UPDATE "JointFight" SET "updatedAt" = datetime('now', '-25 hours') WHERE id = ?`, fight.id);

  const open = await getOpenJointFightFor(a.c.id);
  assert(open === null, "the stale fight no longer counts as open");
  const fightAfter = await prisma.jointFight.findUniqueOrThrow({ where: { id: fight.id } });
  assert(fightAfter.status === "CANCELLED", "the fight itself is closed out, same as before");
  const chAfter = await prisma.canonChallenge.findUniqueOrThrow({ where: { id: ch.id } });
  assert(chAfter.stage === "LOST", "going stale now settles the linked CanonChallenge instead of orphaning it");

  const here = await getCanonHere(a.c.id);
  assert(here!.challenge === null, "the panel no longer shows a stuck challenge");
  const err = await rejects(startCanonChallenge(a.c.id, a.u.id, perospero.id));
  assert(err === null, `the player can immediately open a real new challenge against someone else (got: ${err})`);

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
