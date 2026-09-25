process.env.JUDGE_STUB = "1"; // the judge is replaced by the deterministic stand-in (more life left = winner)
// "Finalizar pelea" against an NPC, against the dev DB (needs a seeded DB: npm run db:reset).
// Usage: npx tsx scripts/close-fight-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { closeFight, GameActionError } from "../src/lib/game/perform-action";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const island = await prisma.island.findFirstOrThrow({ where: { name: { contains: "Foosha" } } });
  const u = await prisma.user.create({ data: { username: `cf${Math.floor(Math.random() * 1e9)}`, passwordHash: "x" } });
  const mk = (name: string) => prisma.character.create({ data: { name: `${name}${Date.now() % 100000}`, faction: "PIRATE", userId: u.id, currentIslandId: island.id, level: 10, hp: 100, maxHp: 100 } });
  const enemy = { name: "Bandido", hp: 100, atk: 8, def: 4, spd: 5, isBoss: false, personality: "terco" };
  const fight = (characterId: string, enemyHp: number, phase = "fighting") =>
    prisma.pendingEncounter.create({ data: { characterId, enemyJson: JSON.stringify(enemy), rewardsJson: JSON.stringify({ berries: 10, xp: 5, bounty: 0, islandDanger: 1 }), narrative: "x", assessment: "even", phase, enemyHp, roundNumber: 3 } });
  const made: string[] = [];
  try {
    const won = await mk("Gana");
    made.push(won.id);
    await fight(won.id, 5);
    await prisma.sceneMessage.create({ data: { characterId: won.id, role: "player", text: "Le clavo la espada." } });
    const r1 = await closeFight(won.id, u.id, "ya lo derroté");
    assert(!!r1.awaitingMercyChoice, "a fight the rival is losing closes as a win and leaves the mercy choice");
    const pe = await prisma.pendingEncounter.findUnique({ where: { characterId: won.id } });
    assert(pe?.phase === "victory" && pe.enemyHp === 0, "the encounter moves to the victory phase with the rival down");
    assert((await prisma.sceneMessage.count({ where: { characterId: won.id, role: "narrator" } })) === 1, "the scene shows why the fight was closed");

    const draw = await mk("Empate");
    made.push(draw.id);
    await fight(draw.id, 100);
    const r2 = await closeFight(draw.id, u.id);
    assert(!r2.awaitingMercyChoice && !r2.died, "an even fight closes with no winner");
    assert(!(await prisma.pendingEncounter.findUnique({ where: { characterId: draw.id } })), "and the encounter is gone");

    const lost = await mk("Pierde");
    made.push(lost.id);
    await prisma.character.update({ where: { id: lost.id }, data: { hp: 5 } });
    await fight(lost.id, 100);
    const r3 = await closeFight(lost.id, u.id);
    assert(!(await prisma.pendingEncounter.findUnique({ where: { characterId: lost.id } })), "a lost fight also closes");
    assert(r3.died === true || r3.hpDelta !== undefined, "and goes through the normal defeat ending");

    const none = await mk("Sin");
    made.push(none.id);
    let refused = false;
    try {
      await closeFight(none.id, u.id);
    } catch (e) {
      refused = e instanceof GameActionError;
    }
    assert(refused, "with no fight in progress there is nothing to close");

    const threat = await mk("Amenaza");
    made.push(threat.id);
    await fight(threat.id, 100, "threat");
    let refused2 = false;
    try {
      await closeFight(threat.id, u.id);
    } catch (e) {
      refused2 = e instanceof GameActionError;
    }
    assert(refused2, "a fight that has not started (still fight-or-flee) cannot be closed this way");

    let wrongUser = false;
    try {
      await closeFight(won.id, "someone-else");
    } catch {
      wrongUser = true;
    }
    assert(wrongUser, "nobody else can close your fight");
  } finally {
    for (const id of made) {
      await prisma.sceneMessage.deleteMany({ where: { characterId: id } });
      await prisma.gameLogEntry.deleteMany({ where: { characterId: id } });
      await prisma.pendingEncounter.deleteMany({ where: { characterId: id } });
      await prisma.newsItem.deleteMany({ where: { characterId: id } }).catch(() => undefined);
      await prisma.character.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
  }
  console.log("ALL PASS");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
