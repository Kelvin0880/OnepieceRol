process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Impel Down check (2026-09-23): a hugely wanted pirate is shipped to the
// island itself, cell level by bounty, no bail, brutal rescue wall.
// Usage: npx tsx scripts/impel-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { captureCharacter, payBail, PrisonError } from "../src/lib/game/prison";
import { canEnterIsland } from "../src/lib/engine/travel";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const stamp = Date.now() % 100000;
  const u = await prisma.user.create({ data: { username: `impel${stamp}`, passwordHash: "x" } });
  const small = await createCharacter(u.id, `Pez${stamp}`, "PIRATE", "swordsman");
  const u2 = await prisma.user.create({ data: { username: `impelB${stamp}`, passwordHash: "x" } });
  const big = await createCharacter(u2.id, `Emperador${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: big.id }, data: { bounty: 1_100_000_000, level: 20, berries: 999_999_999 } });

  const impelIsland = await prisma.island.findUniqueOrThrow({ where: { name: "Impel Down" } });
  assert(impelIsland.minLevelToEnter >= 45, "Impel Down demands a very high level to enter");
  const enies = await prisma.island.findUniqueOrThrow({ where: { name: "Enies Lobby" } });
  assert((JSON.parse(enies.connections) as string[]).includes(impelIsland.id), "Impel Down is reachable only through Enies Lobby");

  const load = (id: string) => prisma.character.findUniqueOrThrow({ where: { id }, include: { currentIsland: true, companions: true } });
  const bigFull = await load(big.id);
  await captureCharacter(bigFull, 120, "Capturado por la Marina.", []);
  const jail = await prisma.imprisonment.findUniqueOrThrow({ where: { characterId: big.id } });
  const moved = await load(big.id);
  assert(jail.cellLevel === 4, "1.1B bounty lands in cell level 4");
  assert(jail.islandId === impelIsland.id && moved.currentIslandId === impelIsland.id, "the prisoner is held on the Impel Down island itself");
  assert(jail.bailBerries === null, "no bail in Impel Down");
  assert(jail.minRescueLevel > 120 * 2, "rescue wall is far above the captor's raw power");
  let bailRefused = false;
  try {
    await payBail(big.id, u2.id);
  } catch (e) {
    bailRefused = e instanceof PrisonError;
  }
  assert(bailRefused, "paying bail is refused even with a fortune");
  assert(!canEnterIsland(20, impelIsland.minLevelToEnter), "a level-20 rescuer cannot even reach the island");

  const smallFull = await load(small.id);
  await captureCharacter(smallFull, 120, "Capturado por la Marina.", []);
  const brig = await prisma.imprisonment.findUniqueOrThrow({ where: { characterId: small.id } });
  assert(brig.cellLevel === 0 && brig.bailBerries !== null, "a small fish stays in the ordinary brig with bail");
  console.log("\nAll Impel Down checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
