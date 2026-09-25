process.env.REFEREE_STUB = "1"; // combat is judged by the AI; scripted checks use the deterministic stand-in
// Deterministic verification for the grudge/memory system, same style as
// delete-character-check.ts / prison-logic-check.ts (direct function calls
// against the real dev DB, not mocked).
// Usage: npx tsx scripts/grudge-check.ts
import { prisma } from "../src/lib/db";
import { fleeCharacter, resolveMercyChoice, exploreCharacter } from "../src/lib/game/perform-action";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function forceLieutenantEncounter(characterId: string, phase: "threat" | "victory") {
  const template = await prisma.eventTemplate.findFirstOrThrow({ where: { title: "La guardia personal de Barbanegra" } });
  const body = JSON.parse(template.bodyJson);
  await prisma.pendingEncounter.deleteMany({ where: { characterId } });
  await prisma.pendingEncounter.create({
    data: {
      characterId,
      enemyJson: JSON.stringify(body.enemy),
      rewardsJson: JSON.stringify({ berries: 20000, xp: 100, bounty: 8000000, islandDanger: 10 }),
      narrative: "[forced for testing]",
      assessment: "even",
      phase,
      enemyHp: phase === "victory" ? 0 : undefined,
    },
  });
  return body.enemy as { name: string; worldActorId: string };
}

async function main() {
  const island = await prisma.island.findUniqueOrThrow({ where: { name: "Isla Cementerio" } });
  const teach = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Marshall D. Teach" } });
  const user = await prisma.user.create({ data: { username: `grudgechk_${Date.now()}`, passwordHash: "x" } });
  const character = await prisma.character.create({
    data: {
      name: "RencorTester",
      faction: "PIRATE",
      userId: user.id,
      currentIslandId: island.id,
      agility: 500, // guarantees flee success against the lieutenant's spd 42
      hp: 500,
      maxHp: 500,
      level: 30,
    },
  });

  // --- Step 1: escape the lieutenant, confirm a real, unconditional grudge write ---
  const enemy = await forceLieutenantEncounter(character.id, "threat");
  assert(enemy.worldActorId === teach.id, "seeded lieutenant carries Marshall D. Teach's worldActorId");

  let fled = false;
  for (let i = 0; i < 20 && !fled; i++) {
    const result = await fleeCharacter(character.id, user.id);
    if (result.log[0]?.startsWith("Logras escabullirte")) {
      fled = true;
      assert(result.newsPosted.length > 0, "successful escape posts real news, not a coin flip");
      assert((result.bountyDelta ?? 0) > 0, "successful escape bumps bounty");
    }
  }
  assert(fled, "escape eventually succeeds with a large agility advantage");

  const grudgeAfterEscape = await prisma.grudge.findUnique({ where: { worldActorId_characterId: { worldActorId: teach.id, characterId: character.id } } });
  assert(grudgeAfterEscape !== null, "a Grudge row now exists after escaping");
  assert((grudgeAfterEscape?.heat ?? 0) > 0, "grudge heat is positive after an escape");
  const heatAfterEscape = grudgeAfterEscape!.heat;

  // --- Step 2: defeat the lieutenant (finish, not spare), confirm heat rises further ---
  await forceLieutenantEncounter(character.id, "victory");
  await resolveMercyChoice(character.id, user.id, false);
  const grudgeAfterDefeat = await prisma.grudge.findUnique({ where: { worldActorId_characterId: { worldActorId: teach.id, characterId: character.id } } });
  assert((grudgeAfterDefeat?.heat ?? 0) > heatAfterEscape, "defeating the subordinate raises heat further on top of the escape");
  assert(grudgeAfterDefeat!.lastIncidentNote.includes("derrotó"), "lastIncidentNote reflects the latest incident, not the stale first one");

  // --- Step 3: sparing lowers heat instead of raising it ---
  await forceLieutenantEncounter(character.id, "victory");
  await resolveMercyChoice(character.id, user.id, true);
  const grudgeAfterMercy = await prisma.grudge.findUnique({ where: { worldActorId_characterId: { worldActorId: teach.id, characterId: character.id } } });
  assert(grudgeAfterMercy!.heat < grudgeAfterDefeat!.heat, "sparing the subordinate lowers heat instead of raising it");

  // --- Step 4: at max heat, a grudge-ambush eventually fires on explore, reusing the enemy snapshot ---
  await prisma.grudge.update({ where: { worldActorId_characterId: { worldActorId: teach.id, characterId: character.id } }, data: { heat: 150 } });
  await prisma.pendingEncounter.deleteMany({ where: { characterId: character.id } });

  let ambushed = false;
  for (let i = 0; i < 60 && !ambushed; i++) {
    const result = await exploreCharacter(character.id, user.id);
    if (result.pendingCombat?.enemyName === "Lugarteniente de Barbanegra" && result.log[0]?.includes("no olvidó")) {
      ambushed = true;
      const pe = await prisma.pendingEncounter.findUnique({ where: { characterId: character.id } });
      const storedEnemy = JSON.parse(pe!.enemyJson);
      assert(storedEnemy.worldActorId === teach.id, "grudge-ambush enemy carries the same worldActorId");
      const seededHp = JSON.parse((await prisma.eventTemplate.findFirstOrThrow({ where: { title: "La guardia personal de Barbanegra" } })).bodyJson).enemy.hp;
      assert(storedEnemy.hp === seededHp, `grudge-ambush reuses the denormalized enemy snapshot stats (hp ${seededHp})`);
    } else if (result.pendingCombat) {
      // some other event triggered combat — clear it and keep trying
      await prisma.pendingEncounter.deleteMany({ where: { characterId: character.id } });
    }
  }
  assert(ambushed, "a grudge-ambush eventually fires at max heat within a reasonable number of explores");

  // Cleanup
  await prisma.grudge.deleteMany({ where: { characterId: character.id } });
  await prisma.pendingEncounter.deleteMany({ where: { characterId: character.id } });
  await prisma.bountyLogEntry.deleteMany({ where: { characterId: character.id } });
  await prisma.gameLogEntry.deleteMany({ where: { characterId: character.id } });
  await prisma.character.delete({ where: { id: character.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("\nAll checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
