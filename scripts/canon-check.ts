process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Canon characters on your island: the panel, tasks, the real vanguard, the duel, the winner's verdict and the owner's confirmation. Usage: npx tsx scripts/canon-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { getCanonHere, requestCanonMission, startCanonChallenge, startCanonDuel, submitCanonVerdict, CanonError } from "../src/lib/game/canon-encounter";
import { closeJointFight } from "../src/lib/game/joint-fight";
import { decideArc } from "../src/lib/game/world-arcs";

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
async function mk(prefix: string, islandName: string, level: number, faction: "PIRATE" | "MARINE" = "PIRATE") {
  const island = await prisma.island.findUniqueOrThrow({ where: { name: islandName } });
  const stamp = `${prefix}${Date.now() % 1000000}`;
  const u = await prisma.user.create({ data: { username: stamp, passwordHash: "x" } });
  const c = await createCharacter(u.id, stamp, faction, faction === "MARINE" ? "swordsman" : "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { level, currentIslandId: island.id, hp: 900, maxHp: 900, maxStamina: 400, stamina: 400 } });
  return { u, c, island };
}
async function winFight(fightId: string, charId: string, userId: string) {
  await prisma.jointFight.update({ where: { id: fightId }, data: { enemyHp: 10 } });
  await prisma.jointFightMessage.create({ data: { fightId, authorCharacterId: null, authorName: "Narrador", text: "El rival cae de rodillas, vencido." } });
  const res = await closeJointFight(charId, userId);
  assert(res.finished && res.outcome === "victory", "the fight is won");
}

async function main() {
  const a = await mk("cana", "Whole Cake Island", 60);
  const here = await getCanonHere(a.c.id);
  const names = here!.actors.map((x) => x.name);
  assert(names.some((n) => n.includes("Katakuri")) && names.some((n) => n.includes("Perospero")), "the panel lists the canon characters on the island");
  assert(!names.includes("Charlotte Linlin (Big Mom)"), "a defeated ex-Yonko no longer roams the panel as active");

  const katakuri = await prisma.worldActor.findFirstOrThrow({ where: { name: "Charlotte Katakuri" } });
  const perospero = await prisma.worldActor.findFirstOrThrow({ where: { name: "Charlotte Perospero" } });

  // Tasks: only real names, a patron, no double task.
  const m = await requestCanonMission(a.c.id, a.u.id, perospero.id);
  const mission = await prisma.mission.findFirstOrThrow({ where: { characterId: a.c.id, patronActorId: perospero.id } });
  assert(m.log.length >= 2 && mission.title.includes("Perospero") && mission.brief.length > 40, "a canon character hands out a task in their name");
  if (mission.targetNpcId) assert(!!(await prisma.islandNpc.findUnique({ where: { id: mission.targetNpcId } })), "the target of the task is a real resident");
  assert(((await rejects(requestCanonMission(a.c.id, a.u.id, perospero.id))) ?? "").includes("sin terminar"), "one open task per patron");

  // Low level cannot challenge.
  const weak = await mk("weak", "Whole Cake Island", 12);
  assert(((await rejects(startCanonChallenge(weak.c.id, weak.u.id, katakuri.id))) ?? "").includes("nivel"), "the level gate stops a weak player");

  // Challenge: the vanguard is a real subordinate (Perospero is the strongest of the crew below Katakuri here).
  await startCanonChallenge(a.c.id, a.u.id, katakuri.id);
  const ch = await prisma.canonChallenge.findFirstOrThrow({ where: { characterId: a.c.id } });
  const fight1 = await prisma.jointFight.findFirstOrThrow({ where: { kind: "canon_vanguard", participants: { some: { characterId: a.c.id } } } });
  const vanguardName = (JSON.parse(fight1.enemyJson) as { name: string }).name;
  const crew = await prisma.worldActor.findMany({ where: { factionName: "Piratas de Big Mom" } });
  assert(ch.stage === "VANGUARD" && crew.some((c) => c.name === vanguardName) && vanguardName !== "Charlotte Katakuri", `the vanguard is a real member of the crew (${vanguardName})`);
  const rival = await mk("rival", "Whole Cake Island", 60);
  assert(((await rejects(startCanonChallenge(rival.c.id, rival.u.id, katakuri.id))) ?? "").includes("ocupado"), "nobody else can challenge them while it is going on");

  await winFight(fight1.id, a.c.id, a.u.id);
  assert((await prisma.canonChallenge.findUniqueOrThrow({ where: { id: ch.id } })).stage === "READY", "beating the vanguard opens the duel");
  assert(((await getCanonHere(a.c.id))!.challenge?.stage) === "READY", "the panel shows the duel is ready");

  // The duel itself, then the verdict waits for the owner.
  await startCanonDuel(a.c.id, a.u.id);
  const fight2 = await prisma.jointFight.findFirstOrThrow({ where: { kind: "canon", participants: { some: { characterId: a.c.id } } } });
  assert((JSON.parse(fight2.enemyJson) as { name: string; isActor: boolean }).name === "Charlotte Katakuri", "the duel is against the character in person");
  await winFight(fight2.id, a.c.id, a.u.id);
  assert((await prisma.canonChallenge.findUniqueOrThrow({ where: { id: ch.id } })).stage === "WON", "winning the duel leaves them at your mercy");
  const still = await prisma.worldActor.findUniqueOrThrow({ where: { id: katakuri.id } });
  assert(still.status === "ACTIVE" && !!still.busyUntil, "nothing permanent happened yet: they are held, not captured");
  await submitCanonVerdict(a.c.id, a.u.id, "capture");
  const arc = await prisma.worldArc.findFirstOrThrow({ where: { kind: "player_verdict", targetActorId: katakuri.id } });
  assert(arc.status === "AWAITING_CONSENT" && arc.requestedChoice === "capture" && arc.requestedById === a.c.id, "the request waits for the owner");
  assert((await prisma.worldActor.findUniqueOrThrow({ where: { id: katakuri.id } })).status === "ACTIVE", "still not captured before the owner confirms");

  const berriesBefore = (await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } })).berries;
  await decideArc(arc.id, true, "Kelvin");
  const done = await prisma.worldActor.findUniqueOrThrow({ where: { id: katakuri.id } });
  assert(done.status === "CAPTURED" && done.prisonLevel !== null, "the owner's approval captures them in Impel Down");
  assert((await prisma.canonChallenge.findUniqueOrThrow({ where: { id: ch.id } })).stage === "DONE", "the challenge is closed");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } })).berries > berriesBefore, "the winner is paid");
  assert((await prisma.gameLogEntry.count({ where: { characterId: a.c.id, text: { contains: "Veredicto sobre" } } })) > 0, "the player is told the result");

  // A denial: they escape. A spare: immediate.
  const b = await mk("canb", "Whole Cake Island", 70);
  const cracker = await prisma.worldActor.findFirstOrThrow({ where: { name: "Charlotte Cracker" } });
  await startCanonChallenge(b.c.id, b.u.id, cracker.id);
  const f3 = await prisma.jointFight.findFirstOrThrow({ where: { kind: "canon_vanguard", participants: { some: { characterId: b.c.id } } } });
  await winFight(f3.id, b.c.id, b.u.id);
  await startCanonDuel(b.c.id, b.u.id);
  const f4 = await prisma.jointFight.findFirstOrThrow({ where: { kind: "canon", participants: { some: { characterId: b.c.id } } } });
  await winFight(f4.id, b.c.id, b.u.id);
  await submitCanonVerdict(b.c.id, b.u.id, "death");
  const arc2 = await prisma.worldArc.findFirstOrThrow({ where: { kind: "player_verdict", targetActorId: cracker.id } });
  await decideArc(arc2.id, false, "Kelvin");
  const survived = await prisma.worldActor.findUniqueOrThrow({ where: { id: cracker.id } });
  assert(survived.status === "ACTIVE" && survived.locationHidden, "a denied request: the character escapes alive");

  const c2 = await mk("canc", "Whole Cake Island", 70);
  const smoothie = await prisma.worldActor.findFirstOrThrow({ where: { name: "Charlotte Smoothie" } });
  await startCanonChallenge(c2.c.id, c2.u.id, smoothie.id);
  await winFight((await prisma.jointFight.findFirstOrThrow({ where: { kind: "canon_vanguard", participants: { some: { characterId: c2.c.id } } } })).id, c2.c.id, c2.u.id);
  await startCanonDuel(c2.c.id, c2.u.id);
  await winFight((await prisma.jointFight.findFirstOrThrow({ where: { kind: "canon", participants: { some: { characterId: c2.c.id } } } })).id, c2.c.id, c2.u.id);
  await submitCanonVerdict(c2.c.id, c2.u.id, "spare");
  assert((await prisma.worldArc.count({ where: { kind: "player_verdict", targetActorId: smoothie.id } })) === 0, "sparing needs no confirmation");
  assert((await prisma.canonChallenge.findFirstOrThrow({ where: { characterId: c2.c.id } })).stage === "DONE", "sparing closes it right away");

  // Rules of the panel.
  const foosha = await mk("fooa", "Pueblo Foosha", 60);
  const shanks = await prisma.worldActor.findFirstOrThrow({ where: { name: "Shanks" } });
  assert(((await rejects(startCanonChallenge(foosha.c.id, foosha.u.id, shanks.id))) ?? "").includes("trono"), "a Yonko is challenged for the throne, not here");
  const makino = await prisma.worldActor.findFirstOrThrow({ where: { name: "Makino" } });
  assert(((await rejects(startCanonChallenge(foosha.c.id, foosha.u.id, makino.id))) ?? "").includes("combatiente"), "a civilian cannot be dueled");
  const marine = await mk("mar", "Cuartel Marine G-5", 60, "MARINE");
  const garp = await prisma.worldActor.findFirstOrThrow({ where: { name: "Monkey D. Garp" } });
  assert(((await rejects(startCanonChallenge(marine.c.id, marine.u.id, garp.id))) ?? "").includes("tuyos"), "you do not go against your own side");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
