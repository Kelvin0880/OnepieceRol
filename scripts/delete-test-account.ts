// Test helper: deletes a user account and everything its characters own, using the same cascade
// players get from "Borrar" (game/delete-character.ts), for cleaning up production smoke-test accounts.
// Usage: npx tsx scripts/delete-test-account.ts <username>
import { prisma } from "../src/lib/db";
import { deleteCharacter } from "../src/lib/game/delete-character";

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error("Usage: delete-test-account.ts <username>");
  const user = await prisma.user.findUnique({ where: { username }, include: { characters: true } });
  if (!user) {
    console.log("No such user:", username);
    return;
  }
  for (const character of user.characters) {
    await prisma.checkpoint.deleteMany({ where: { characterId: character.id } });
    await prisma.oocReport.deleteMany({ where: { characterId: character.id } });
    await deleteCharacter(character.id, user.id);
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
