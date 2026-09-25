process.env.REFEREE_STUB = "1"; // combat is judged by the AI; scripted checks use the deterministic stand-in
process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Poneglyph guardians + stealth (2026-09-24). Direct function calls against the
// dev DB (real AI narration is used where the game calls it).
// Usage: npx tsx scripts/guardian-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { applyGuardianPresence, findPoneglyphGuardian } from "../src/lib/game/guardian";
import { sneakPoneglyph, resolveMercyChoice, GameActionError } from "../src/lib/game/perform-action";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function mk(tag: string, island: string, stats: Partial<{ agility: number; intellect: number; level: number; hp: number; maxHp: number }>) {
  const u = await prisma.user.create({ data: { username: `gd${tag}${Date.now() % 1_000_000}`, passwordHash: "x" } });
  return prisma.character.create({
    data: { name: `${tag}${Date.now() % 100000}`, faction: "PIRATE", userId: u.id, currentIslandId: island, hp: 200, maxHp: 200, level: 20, ...stats },
  });
}

async function main() {
  const island = await prisma.island.findUniqueOrThrow({ where: { name: "Isla Cementerio" } });
  const teach = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Marshall D. Teach" } });
  const guardian = await findPoneglyphGuardian(island.id);
  assert(!!guardian && guardian.enemy.worldActorId === teach.id, "Isla Cementerio's guardian is Teach's lieutenant, with the Poneglyph attached");

  // --- Presence: home => usually the real holder; away => only the subordinate ---
  await prisma.worldActor.update({ where: { id: teach.id }, data: { busyUntil: null } });
  const sub = { ...guardian!.enemy, isBoss: true };
  let actors = 0;
  for (let i = 0; i < 200; i++) if ((await applyGuardianPresence(sub)).enemy.isActor) actors++;
  assert(actors === 200, `a home holder always receives in person (${actors}/200)`);
  const real = (await applyGuardianPresence(sub)).enemy;
  assert(real.isActor === true && real.name === teach.name && real.hp > guardian!.enemy.hp * 1.5, `the real Teach is far tougher than the lieutenant (${real.hp} hp vs ${guardian!.enemy.hp})`);

  await prisma.worldActor.update({ where: { id: teach.id }, data: { busyUntil: new Date(Date.now() + 3600_000) } });
  let awayActors = 0;
  for (let i = 0; i < 100; i++) if ((await applyGuardianPresence(sub)).enemy.isActor) awayActors++;
  assert(awayActors === 0, "with the holder away on world business only the subordinate guards");

  // --- Stealth: a master reads it, a clumsy one brings the guardian ---
  await prisma.worldActor.update({ where: { id: teach.id }, data: { busyUntil: new Date(Date.now() + 3600_000) } });
  let readOne = false;
  let quietSeen = false;
  for (let i = 0; i < 12 && !readOne; i++) {
    const master = await mk("Sombra", island.id, { agility: 900, intellect: 300 });
    const before = await prisma.newsItem.count({ where: { characterId: master.id } });
    const r = await sneakPoneglyph(master.id, master.userId, "Me cuelo por los conductos de ventilación, sin hacer ruido.", 15);
    const after = await prisma.character.findUniqueOrThrow({ where: { id: master.id } });
    if (r.poneglyphGained) {
      readOne = true;
      assert((JSON.parse(after.poneglyphsRead) as string[]).length === 1, "a successful infiltration reads the Poneglyph without any fight");
      assert(after.poneglyphHeat <= 50, `stealth leaves a lighter trail than a fight (heat ${after.poneglyphHeat} <= 50)`);
      const news = await prisma.newsItem.count({ where: { characterId: master.id } });
      quietSeen = news === before;
      if (quietSeen) console.log("PASS: a clean infiltration makes no news");
      assert(after.stamina < 100, "stealth costs stamina");
    }
  }
  assert(readOne, "a strong sneaker eventually reads the stone");

  let fights = 0;
  let hurt = 0;
  for (let i = 0; i < 8; i++) {
    const klutz = await mk("Torpe", island.id, { agility: 1, intellect: 1, level: 1 });
    const r = await sneakPoneglyph(klutz.id, klutz.userId, "Corro gritando hacia la piedra.", -15);
    const pe = await prisma.pendingEncounter.findUnique({ where: { characterId: klutz.id } });
    if (pe) {
      fights++;
      assert(pe.phase === "threat" && JSON.parse(pe.rewardsJson).poneglyphId === guardian!.poneglyphId, "a failed infiltration opens the guardian fight with the Poneglyph as loot");
      if (r.hpDelta < 0) hurt++;
    }
  }
  assert(fights >= 6, `clumsy sneakers mostly bring the guardian (${fights}/8)`);
  console.log(`INFO: caught-with-damage cases: ${hurt}`);

  const again = await mk("Repetido", island.id, { agility: 900 });
  await prisma.character.update({ where: { id: again.id }, data: { poneglyphsRead: JSON.stringify([guardian!.poneglyphId]) } });
  let refused = false;
  try {
    await sneakPoneglyph(again.id, again.userId, "Me cuelo otra vez.", 0);
  } catch (e) {
    refused = e instanceof GameActionError;
  }
  assert(refused, "cannot sneak to a Poneglyph already read");

  // --- Beating the real holder: the holder withdraws, holds a bigger grudge ---
  const hero = await mk("Heroe", island.id, { level: 40 });
  await prisma.worldActor.update({ where: { id: teach.id }, data: { busyUntil: null } });
  await prisma.pendingEncounter.create({
    data: {
      characterId: hero.id,
      enemyJson: JSON.stringify(real),
      rewardsJson: JSON.stringify({ berries: 1000, xp: 300, bounty: 1_000_000, islandDanger: 10, poneglyphId: guardian!.poneglyphId }),
      narrative: "[forced]",
      assessment: "superior",
      phase: "victory",
      enemyHp: 0,
    },
  });
  await resolveMercyChoice(hero.id, hero.userId, false);
  const teachAfter = await prisma.worldActor.findUniqueOrThrow({ where: { id: teach.id } });
  assert(!!teachAfter.busyUntil && teachAfter.busyUntil.getTime() > Date.now(), "the defeated holder withdraws to recover");
  const grudge = await prisma.grudge.findUniqueOrThrow({ where: { worldActorId_characterId: { worldActorId: teach.id, characterId: hero.id } } });
  assert(grudge.heat >= 60, `beating the holder in person leaves a heavy grudge (${grudge.heat})`);
  assert((await prisma.newsItem.count({ where: { headline: { contains: "humilla" } } })) > 0, "the holder's defeat makes major news");
  await prisma.worldActor.update({ where: { id: teach.id }, data: { busyUntil: null, currentFocus: null } });

  console.log("ALL PASS");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
