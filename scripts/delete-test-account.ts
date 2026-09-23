// Test helper: deletes a user account and all owned characters/weapons/etc
// via cascading relations, for cleaning up production smoke-test accounts.
// Usage: npx tsx scripts/delete-test-account.ts <username>
import { prisma } from "../src/lib/db";

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error("Usage: delete-test-account.ts <username>");
  const user = await prisma.user.findUnique({ where: { username }, include: { characters: true } });
  if (!user) {
    console.log("No such user:", username);
    return;
  }
  for (const character of user.characters) {
    await prisma.character.update({ where: { id: character.id }, data: { equippedWeaponId: null } });
    await prisma.weapon.deleteMany({ where: { ownerId: character.id } });
    await prisma.gameLogEntry.deleteMany({ where: { characterId: character.id } });
    await prisma.pendingEncounter.deleteMany({ where: { characterId: character.id } });
    await prisma.imprisonment.deleteMany({ where: { characterId: character.id } });
    await prisma.character.delete({ where: { id: character.id } });
  }
  await prisma.user.delete({ where: { id: user.id } });
  console.log("Deleted user + characters:", username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
