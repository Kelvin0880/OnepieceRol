process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Deterministic cascade check for deleteCharacter, no browser needed —
// mirrors the style of scripts/prison-logic-check.ts (direct function calls
// against the real dev DB, not mocked).
// Usage: npx tsx scripts/delete-character-check.ts
import { prisma } from "../src/lib/db";
import { deleteCharacter } from "../src/lib/game/delete-character";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const island = await prisma.island.findFirstOrThrow();
  const user = await prisma.user.create({ data: { username: `delchk_${Date.now()}`, passwordHash: "x" } });

  const captain = await prisma.character.create({
    data: { name: "CapitanBorrable", faction: "PIRATE", userId: user.id, currentIslandId: island.id, isCaptain: true },
  });
  const mate = await prisma.character.create({
    data: { name: "CompañeroQueQueda", faction: "PIRATE", userId: user.id, currentIslandId: island.id },
  });

  const crew = await prisma.crew.create({
    data: { name: `TripulacionBorrable_${Date.now()}`, flagDesc: "test", captainId: captain.id },
  });
  await prisma.character.updateMany({ where: { id: { in: [captain.id, mate.id] } }, data: { crewId: crew.id } });

  const party = await prisma.party.create({
    data: { crewId: crew.id, turnOrder: JSON.stringify([captain.id, mate.id]) },
  });
  await prisma.character.updateMany({ where: { id: { in: [captain.id, mate.id] } }, data: { partyId: party.id } });

  // Weapon.ownerId is @unique — a character owns at most one weapon at a
  // time — so the common-vs-meito behaviors are tested on two characters.
  const commonWeapon = await prisma.weapon.create({
    data: { name: "Espada oxidada de prueba", kind: "Katana", grade: "NONE", description: "test", ownerId: captain.id },
  });
  await prisma.character.update({ where: { id: captain.id }, data: { equippedWeaponId: commonWeapon.id } });

  const meitoOwner = await prisma.character.create({
    data: { name: "DueñoDeMeitoBorrable", faction: "PIRATE", userId: user.id, currentIslandId: island.id },
  });
  const meito = await prisma.weapon.create({
    data: { name: "Meito de prueba", kind: "Katana", grade: "UNIQUE", description: "test", ownerId: meitoOwner.id },
  });

  await prisma.gameLogEntry.create({ data: { characterId: captain.id, kind: "test", text: "log" } });
  await prisma.bountyLogEntry.create({ data: { characterId: captain.id, delta: 100, reason: "test" } });
  await prisma.sceneMessage.create({ data: { characterId: captain.id, role: "player", text: "hola" } });
  await prisma.inventoryItem.create({ data: { characterId: captain.id, name: "Poción", kind: "Consumible" } });
  await prisma.pendingEncounter.create({
    data: { characterId: captain.id, enemyJson: JSON.stringify({ name: "e", hp: 1, atk: 1, def: 1, spd: 1 }), rewardsJson: "{}", narrative: "n", assessment: "even" },
  });

  const { name } = await deleteCharacter(captain.id, user.id);
  assert(name === "CapitanBorrable", "returns the deleted character's name");
  await deleteCharacter(meitoOwner.id, user.id);

  const gone = await prisma.character.findUnique({ where: { id: captain.id } });
  assert(gone === null, "character row is gone");

  assert((await prisma.gameLogEntry.count({ where: { characterId: captain.id } })) === 0, "GameLogEntry rows gone");
  assert((await prisma.bountyLogEntry.count({ where: { characterId: captain.id } })) === 0, "BountyLogEntry rows gone");
  assert((await prisma.sceneMessage.count({ where: { characterId: captain.id } })) === 0, "SceneMessage rows gone");
  assert((await prisma.inventoryItem.count({ where: { characterId: captain.id } })) === 0, "InventoryItem rows gone");
  assert((await prisma.pendingEncounter.count({ where: { characterId: captain.id } })) === 0, "PendingEncounter rows gone");

  const commonWeaponAfter = await prisma.weapon.findUnique({ where: { id: commonWeapon.id } });
  assert(commonWeaponAfter === null, "common instanced weapon was deleted, not left orphaned");

  const meitoAfter = await prisma.weapon.findUnique({ where: { id: meito.id } });
  assert(meitoAfter !== null && meitoAfter.ownerId === null, "unique meito survives, unclaimed");

  const crewAfter = await prisma.crew.findUnique({ where: { id: crew.id } });
  assert(crewAfter !== null && crewAfter.captainId === mate.id, "captaincy handed off to remaining member");

  const mateAfter = await prisma.character.findUnique({ where: { id: mate.id } });
  assert(mateAfter?.isCaptain === true, "remaining member flagged as captain");
  assert(mateAfter?.partyId === null, "remaining member's party was dissolved (dropped below 2)");

  const partyAfter = await prisma.party.findUnique({ where: { id: party.id } });
  assert(partyAfter === null, "party row itself was deleted");

  // Cleanup
  await prisma.weapon.delete({ where: { id: meito.id } });
  await prisma.character.delete({ where: { id: mate.id } });
  await prisma.crew.delete({ where: { id: crew.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } });

  console.log("\nAll checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
