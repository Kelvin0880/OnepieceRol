// Kill-vs-spare aftermath against the dev DB: threads resurface, branch by choice, chain up to 3 stages.
// Usage: npx tsx scripts/consequence-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { mulberry32 } from "../src/lib/engine/rng";
import { recordConsequence, rollConsequenceForExplore } from "../src/lib/game/consequences";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const island = await prisma.island.findFirstOrThrow({ where: { name: "Loguetown" } });
  const actor = await prisma.worldActor.findFirstOrThrow({ where: { name: "Marshall D. Teach" } });
  const u = await prisma.user.create({ data: { username: `cq${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const c = await prisma.character.create({ data: { name: `Karma${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: island.id, hp: 100, maxHp: 100 } });
  const stats = { atk: 20, def: 10, spd: 10 };

  await recordConsequence(c.id, { name: "Lugarteniente de Barbanegra", worldActorId: actor.id }, "spared", island);
  const row = await prisma.consequence.findFirstOrThrow({ where: { characterId: c.id } });
  assert(row.stage === 1 && !row.resolvedAt, "sparing leaves an unresolved stage-1 thread");
  const rng = mulberry32(5);
  let early = null;
  for (let i = 0; i < 30; i++) early = early ?? (await rollConsequenceForExplore(c, stats, 6, rng));
  assert(early === null, "nothing resurfaces before its delay");

  const seen = new Set<string>();
  for (let n = 0; n < 60; n++) {
    await prisma.consequence.deleteMany({ where: { characterId: c.id } });
    await recordConsequence(c.id, { name: "Rival", worldActorId: actor.id }, n % 2 ? "spared" : "killed", island);
    await prisma.consequence.updateMany({ where: { characterId: c.id }, data: { dueAt: new Date(Date.now() - 1000) } });
    let res = null;
    for (let i = 0; i < 40 && !res; i++) res = await rollConsequenceForExplore(c, stats, 6, rng);
    assert(!!res, `thread ${n} eventually resurfaces`);
    const done = await prisma.consequence.findFirstOrThrow({ where: { characterId: c.id } });
    assert(!!done.resolvedAt && !!done.outcome, "it is marked resolved with an outcome");
    seen.add(done.outcome!);
    if (res!.encounter) assert(res!.encounter.consequenceStage === 1 && res!.encounter.stats.hp > 0, "a returning enemy carries its stage");
  }
  assert(["boon", "betrayal", "avenger", "tribute"].every((o) => seen.has(o)), "all four branches occurred");

  await prisma.consequence.deleteMany({ where: { characterId: c.id } });
  await recordConsequence(c.id, { name: "Vengador", consequenceStage: 2 }, "killed", island);
  assert((await prisma.consequence.findFirstOrThrow({ where: { characterId: c.id } })).stage === 3, "a returning enemy's fate chains to the next stage");
  console.log("ALL CONSEQUENCE CHECKS PASSED");
}
main().finally(() => prisma.$disconnect());
