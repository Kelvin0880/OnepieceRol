process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Group-fight safety nets: the group judge can close a stuck fight (only when the numbers agree), and a stalled round
// (everyone answered, nobody judged) can be retried by re-sending, by the button, or by the state poll.
// Direct function calls against the dev DB. Usage: npx tsx scripts/joint-close-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { startJointFight, closeJointFight, retryJointRound, getOpenJointFightFor, getJointFightStateForCharacter, JointFightError } from "../src/lib/game/joint-fight";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function mk(stamp: number, tag: string) {
  const u = await prisma.user.create({ data: { username: `jc${tag}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${tag}${stamp}`, "PIRATE", "swordsman");
  return { user: u, char: c };
}

async function newFight(a: { char: { id: string } }, b: { char: { id: string } }) {
  const started = await startJointFight({
    kind: "party",
    characterIds: [a.char.id, b.char.id],
    enemy: { name: "Bandido de poca monta", hp: 80, atk: 20, def: 14, spd: 10, isBoss: false },
    rewards: { berries: 100, xp: 30, bounty: 0, islandDanger: 1 },
  });
  return started.fightId;
}

async function main() {
  const stamp = Date.now() % 100000;
  const a = await mk(stamp, "Uno");
  const b = await mk(stamp, "Dos");
  await prisma.character.update({ where: { id: b.char.id }, data: { currentIslandId: a.char.currentIslandId } });

  // 1) Closing with the rival still healthy is refused as a win: no winner, nobody gains anything.
  let fightId = await newFight(a, b);
  const before = await prisma.character.findUniqueOrThrow({ where: { id: a.char.id } });
  const r1 = await closeJointFight(a.char.id, a.user.id, "ganamos");
  assert(r1.finished && r1.outcome === undefined, "a healthy rival cannot be declared beaten: closed with no winner");
  assert((await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId } })).status === "CANCELLED", "the fight is cancelled");
  const afterA = await prisma.character.findUniqueOrThrow({ where: { id: a.char.id } });
  assert(afterA.berries === before.berries, "no rewards for an unearned win");
  assert(!(await getOpenJointFightFor(b.char.id)), "both allies are free again");

  // 2) Rival at half life or less: the judge's win is accepted and pays the group.
  fightId = await newFight(a, b);
  await prisma.jointFight.update({ where: { id: fightId }, data: { enemyHp: 10 } });
  await prisma.jointFightMessage.create({ data: { fightId, authorCharacterId: null, authorName: "Narrador", text: "El último matón cae de rodillas y se rinde." } });
  const r2 = await closeJointFight(b.char.id, b.user.id);
  assert(r2.finished && r2.outcome === "victory", "a beaten rival: the group wins");
  const paid = await prisma.character.findUniqueOrThrow({ where: { id: a.char.id } });
  assert(paid.berries > afterA.berries, "the win pays every ally");

  // 3) Someone outside the fight cannot close it.
  fightId = await newFight(a, b);
  const c = await mk(stamp, "Tres");
  let refused = false;
  try {
    await closeJointFight(c.char.id, c.user.id);
  } catch (e) {
    refused = e instanceof JointFightError;
  }
  assert(refused, "a stranger cannot close someone else's fight");

  // 4) A stalled round: everyone answered, nobody judged. Too soon = refused; after the window = retried.
  await prisma.jointFightParticipant.updateMany({ where: { fightId, isNpc: false }, data: { action: "Ataco al bandido con todo." } });
  let tooSoon = false;
  try {
    await retryJointRound(fightId);
  } catch (e) {
    tooSoon = e instanceof JointFightError;
  }
  assert(tooSoon, "a round that is probably still being judged is not re-judged");
  let state = await getJointFightStateForCharacter(a.char.id);
  assert(state?.stalled === false, "not reported as stalled yet");
  await prisma.jointFight.update({ where: { id: fightId }, data: { roundStartedAt: new Date(Date.now() - 10 * 60_000) } });
  state = await getJointFightStateForCharacter(a.char.id); // the poll itself re-judges a stalled round
  assert(state?.stalled === true, "reported as stalled after the window");
  let advanced = false;
  for (let i = 0; i < 40 && !advanced; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const f = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId } });
    advanced = f.round >= 2 || f.status !== "ACTIVE";
  }
  assert(advanced, "the state poll healed the stalled round by itself");
  await prisma.jointFight.update({ where: { id: fightId }, data: { status: "CANCELLED" } });

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
