// Test helper: force-captures a character by id, bypassing combat RNG.
// Usage: npx tsx scripts/force-capture.ts <characterId>
import { prisma } from "../src/lib/db";
import { captureCharacter } from "../src/lib/game/prison";

async function main() {
  const characterId = process.argv[2];
  if (!characterId) throw new Error("Usage: force-capture.ts <characterId>");

  const character = await prisma.character.update({
    where: { id: characterId },
    data: { berries: 999_999 },
    include: { currentIsland: true },
  });
  await captureCharacter(character, 60, "Emboscada de la Marina en pleno muelle.", []);
  console.log("Captured", character.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
