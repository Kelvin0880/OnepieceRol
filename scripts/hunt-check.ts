process.env.REFEREE_STUB = "1"; // combat is judged by the AI; scripted checks use the deterministic stand-in
// Deterministic-ish check of real PvP: a Marine hunting a pirate to the death
// (2026-09-23). Direct function calls against the dev DB; classification of
// each move uses the real AI (needs OPENROUTER_API_KEY). Usage: npx tsx scripts/hunt-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { challengeDuel, respondToDuel, submitDuelAction, DuelError } from "../src/lib/game/duel";
import { decideVerdict } from "../src/lib/game/duel-resolution";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function expectError(fn: () => Promise<unknown>, pattern: RegExp, label: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof DuelError && pattern.test(e.message), label);
    return;
  }
  throw new Error(`FAIL: ${label} (no error thrown)`);
}

async function main() {
  const stamp = Date.now() % 100000;
  const uA = await prisma.user.create({ data: { username: `huntA${stamp}`, passwordHash: "x" } });
  const uB = await prisma.user.create({ data: { username: `huntB${stamp}`, passwordHash: "x" } });
  const uC = await prisma.user.create({ data: { username: `huntC${stamp}`, passwordHash: "x" } });
  const marine = await createCharacter(uA.id, `Cazador${stamp}`, "MARINE", "swordsman");
  const pirate = await createCharacter(uB.id, `Presa${stamp}`, "PIRATE", "swordsman");
  const pirate2 = await createCharacter(uC.id, `Otro${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: marine.id }, data: { currentIslandId: pirate.currentIslandId, strength: 90, agility: 90, durability: 90, level: 5, maxHp: 200, hp: 200 } });
  await prisma.character.update({ where: { id: pirate2.id }, data: { level: 5 } });

  // Novice protection, offline protection.
  await prisma.character.update({ where: { id: pirate.id }, data: { level: 2, lastSeenAt: new Date() } });
  await expectError(() => challengeDuel(marine.id, uA.id, pirate.id, true), /protección/, "novices cannot be hunted");
  await prisma.character.update({ where: { id: pirate.id }, data: { level: 5, lastSeenAt: null } });
  await expectError(() => challengeDuel(marine.id, uA.id, pirate.id, true), /conectada/, "offline players cannot be hunted");

  // Same faction: lethal needs consent (not a hunt).
  await prisma.character.update({ where: { id: pirate2.id }, data: { currentIslandId: pirate.currentIslandId } });
  const consent = await challengeDuel(pirate.id, uB.id, pirate2.id, true);
  const consentDuel = await prisma.duel.findUniqueOrThrow({ where: { id: consent.duelId } });
  assert(consentDuel.lethal && !consentDuel.hostile, "same-faction lethal duel is consensual, not a hunt");
  await respondToDuel(pirate2.id, uC.id, consent.duelId, false);
  assert((await prisma.duel.findUniqueOrThrow({ where: { id: consent.duelId } })).status === "DECLINED", "a consensual lethal duel can be declined");

  // The hunt itself.
  await prisma.character.update({ where: { id: pirate.id }, data: { lastSeenAt: new Date() } });
  const hunt = await challengeDuel(marine.id, uA.id, pirate.id, true);
  const huntDuel = await prisma.duel.findUniqueOrThrow({ where: { id: hunt.duelId } });
  assert(huntDuel.lethal && huntDuel.hostile, "Marine vs pirate lethal challenge is a hostile hunt");
  assert(huntDuel.challengerHp === 200, "lethal duel starts from real current HP");

  await respondToDuel(pirate.id, uB.id, hunt.duelId, true);
  let finished = false;
  for (let i = 0; i < 14 && !finished; i++) {
    await submitDuelAction(marine.id, uA.id, "Ataco con mi arma a su pecho.");
    const r = await submitDuelAction(pirate.id, uB.id, "Intento contraatacar con mi espada.");
    finished = "finished" in r && !!r.finished;
  }
  assert(finished, "the hunt ended with a decisive result");

  // The winner now decides the loser's fate (game/duel-resolution.ts); here they spare them so the cooldown can be checked.
  const decided = await prisma.duel.findUniqueOrThrow({ where: { id: hunt.duelId } });
  assert(decided.resolution === "VERDICT" && !!decided.winnerId, "the fallen fighter waits for the winner's verdict");
  const winner = decided.winnerId === marine.id ? { id: marine.id, userId: uA.id } : { id: pirate.id, userId: uB.id };
  await decideVerdict(winner.id, winner.userId, hunt.duelId, "spare");
  const prey = await prisma.character.findUniqueOrThrow({ where: { id: pirate.id } });
  const hunter = await prisma.character.findUniqueOrThrow({ where: { id: marine.id } });
  console.log("Prey status:", prey.status, "hp", prey.hp, "| hunter hp", hunter.hp, "notoriety", hunter.notoriety);
  assert(prey.status === "ALIVE" && prey.hp > 0, "sparing leaves the loser alive with a little HP");
  const news = await prisma.newsItem.findFirst({ where: { headline: { contains: "duelo a muerte" } }, orderBy: { createdAt: "desc" } });
  assert(!!news && !!news.locationName, "a fight to the death makes news with its place");

  // Repeat-hunt cooldown.
  if (prey.status === "ALIVE") {
    await prisma.character.update({ where: { id: pirate.id }, data: { lastSeenAt: new Date() } });
    await expectError(() => challengeDuel(marine.id, uA.id, pirate.id, true), /respirar/, "the same hunter cannot immediately re-hunt the same target");
  }
  console.log("\nAll hunt checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
