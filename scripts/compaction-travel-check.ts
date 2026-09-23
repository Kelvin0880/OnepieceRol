// Verifies (1) silent scene compaction folds old messages into memorySummary
// with the real AI, and (2) travel cooldown / crew-busy / stamina rules.
// Usage: npx tsx scripts/compaction-travel-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { maybeCompactCharacterScene, KEEP_RECENT_MESSAGES } from "../src/lib/game/scene-compaction";
import { travelCharacter, GameActionError } from "../src/lib/game/perform-action";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const stamp = Date.now() % 100000;
  const u = await prisma.user.create({ data: { username: `ct${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `Viajero${stamp}`, "PIRATE", "swordsman");

  // --- compaction ---
  const base = Date.now() - 3_600_000;
  const rows = [];
  for (let i = 0; i < 30; i++) {
    rows.push({
      characterId: c.id,
      role: i % 2 === 0 ? "player" : "narrator",
      text: i % 2 === 0 ? `Le pregunto al tabernero Gorm por el mapa ${i}.` : `Gorm, un tabernero de barba roja, promete conseguirle el mapa ${i} a cambio de una deuda de 500 berries.`,
      createdAt: new Date(base + i * 1000),
    });
  }
  await prisma.sceneMessage.createMany({ data: rows });
  await maybeCompactCharacterScene(c.id);
  const after = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
  console.log("memorySummary:", after.memorySummary);
  assert(!!after.memorySummary && after.memorySummary.length > 20, "old scene messages were folded into memorySummary");
  assert(after.sceneCompactedUntil !== null, "compaction marker advanced");
  const remaining = await prisma.sceneMessage.count({ where: { characterId: c.id, createdAt: { gt: after.sceneCompactedUntil! } } });
  assert(remaining === KEEP_RECENT_MESSAGES, "exactly the recent window is left uncompacted");
  assert((await prisma.sceneMessage.count({ where: { characterId: c.id } })) === 30, "the on-screen transcript is untouched");

  // --- travel ---
  const fresh = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, include: { currentIsland: true } });
  const [firstTarget, secondTarget] = JSON.parse(fresh.currentIsland.connections) as string[];
  await travelCharacter(c.id, u.id, firstTarget);
  const moved = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
  assert(moved.lastTravelAt !== null && moved.stamina < 100, "sailing records the time and costs stamina");
  let blocked = "";
  try {
    const back = await prisma.island.findUniqueOrThrow({ where: { id: fresh.currentIslandId } });
    await travelCharacter(c.id, u.id, back.id);
  } catch (e) {
    blocked = e instanceof GameActionError ? e.message : "";
  }
  assert(/no está listo para volver a zarpar/.test(blocked), "a second crossing right away is refused by the cooldown");
  void secondTarget;

  // crew-busy rule
  const u2 = await prisma.user.create({ data: { username: `ct2${stamp}`, passwordHash: "x" } });
  const mate = await createCharacter(u2.id, `Compa${stamp}`, "PIRATE", "swordsman");
  const crew = await prisma.crew.create({ data: { name: `Tripu${stamp}`, flagDesc: "x", captainId: c.id } });
  await prisma.character.update({ where: { id: c.id }, data: { crewId: crew.id, lastTravelAt: null } });
  await prisma.character.update({ where: { id: mate.id }, data: { crewId: crew.id, currentIslandId: moved.currentIslandId } });
  await prisma.pendingEncounter.create({
    data: { characterId: mate.id, enemyJson: JSON.stringify({ name: "X", hp: 10, atk: 1, def: 1, spd: 1, isBoss: false }), rewardsJson: "{}", narrative: "x", assessment: "even" },
  });
  const here = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, include: { currentIsland: true } });
  let crewBlocked = "";
  try {
    await travelCharacter(c.id, u.id, (JSON.parse(here.currentIsland.connections) as string[])[0]);
  } catch (e) {
    crewBlocked = e instanceof GameActionError ? e.message : "";
  }
  assert(/sigue con un enfrentamiento sin resolver/.test(crewBlocked), "the crew cannot sail while a crewmate has an unresolved fight");
  console.log("\nAll compaction/travel checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
