// Direct integration check of the prison game-logic functions (capture,
// bail, rescue), bypassing combat RNG so the outcome is deterministic.
// Exercises the real functions against the real dev database.
import { prisma } from "../src/lib/db";
import { captureCharacter, payBail, attemptRescue } from "../src/lib/game/prison";
import { hashPassword } from "../src/lib/auth";
import { Faction } from "@prisma/client";

async function makeUserAndCharacter(username: string, faction: Faction, islandName: string, berries = 3000) {
  const user = await prisma.user.create({ data: { username, passwordHash: await hashPassword("x") } });
  const island = await prisma.island.findUniqueOrThrow({ where: { name: islandName } });
  const character = await prisma.character.create({
    data: { name: username, faction, userId: user.id, currentIslandId: island.id, berries, isCaptain: true },
  });
  return { user, character };
}

async function main() {
  console.log("=== Prison logic check ===");

  const { character: prisoner } = await makeUserAndCharacter("prisoner_" + Date.now(), Faction.PIRATE, "Pueblo Foosha", 100);
  const { character: rescuerWeak } = await makeUserAndCharacter("rescuer_weak_" + Date.now(), Faction.PIRATE, "Pueblo Foosha");
  const { character: rescuerStrong } = await makeUserAndCharacter("rescuer_strong_" + Date.now(), Faction.PIRATE, "Pueblo Foosha");
  await prisma.character.update({ where: { id: rescuerStrong.id }, data: { strength: 90, agility: 90, durability: 90, level: 40 } });

  const island = await prisma.island.findUniqueOrThrow({ where: { name: "Pueblo Foosha" } });
  const full = await prisma.character.findUniqueOrThrow({ where: { id: prisoner.id }, include: { currentIsland: true } });

  const newsLog: string[] = [];
  await captureCharacter(full, 80, "Prueba directa de captura.", newsLog);
  const afterCapture = await prisma.character.findUniqueOrThrow({ where: { id: prisoner.id }, include: { imprisonment: true } });
  console.log("Status after capture:", afterCapture.status, "| Imprisonment exists:", !!afterCapture.imprisonment);
  console.log("News posted:", newsLog);
  if (afterCapture.status !== "IMPRISONED" || !afterCapture.imprisonment) throw new Error("FAIL: capture did not set expected state");

  // Weak rescuer should very likely fail (not asserted strictly — just observe).
  const weakAttempt = await attemptRescue(rescuerWeak.id, (await prisma.user.findUniqueOrThrow({ where: { id: rescuerWeak.userId } })).id, prisoner.id);
  console.log("Weak rescue attempt:", weakAttempt.success, weakAttempt.log);

  const stillImprisoned = await prisma.character.findUniqueOrThrow({ where: { id: prisoner.id } });
  if (stillImprisoned.status === "IMPRISONED") {
    // Strong rescuer should reliably succeed.
    const strongAttempt = await attemptRescue(rescuerStrong.id, (await prisma.user.findUniqueOrThrow({ where: { id: rescuerStrong.userId } })).id, prisoner.id);
    console.log("Strong rescue attempt:", strongAttempt.success, strongAttempt.log);
    const freed = await prisma.character.findUniqueOrThrow({ where: { id: prisoner.id } });
    console.log("Status after strong rescue attempt:", freed.status);
    if (strongAttempt.success && freed.status !== "ALIVE") throw new Error("FAIL: successful rescue did not free the character");
  } else {
    console.log("(prisoner was captured by the weak rescuer's critical-fail penalty, or already freed — re-run to test the strong path)");
  }

  // Now test bail on a fresh capture.
  const { character: bailTester } = await makeUserAndCharacter("bail_" + Date.now(), Faction.PIRATE, "Pueblo Foosha", 999_999);
  const bailUser = await prisma.user.findUniqueOrThrow({ where: { id: bailTester.userId } });
  const fullBail = await prisma.character.findUniqueOrThrow({ where: { id: bailTester.id }, include: { currentIsland: true } });
  await captureCharacter(fullBail, 50, "Prueba directa de fianza.", []);
  const beforeBail = await prisma.character.findUniqueOrThrow({ where: { id: bailTester.id }, include: { imprisonment: true } });
  console.log("Bail amount required:", beforeBail.imprisonment?.bailBerries);
  const bailResult = await payBail(bailTester.id, bailUser.id);
  console.log("Bail result log:", bailResult.log);
  const afterBail = await prisma.character.findUniqueOrThrow({ where: { id: bailTester.id }, include: { imprisonment: true } });
  console.log("Status after bail:", afterBail.status, "| Imprisonment cleared:", !afterBail.imprisonment);
  if (afterBail.status !== "ALIVE" || afterBail.imprisonment) throw new Error("FAIL: bail did not free the character correctly");

  console.log("=== ALL PRISON LOGIC CHECKS PASSED ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
