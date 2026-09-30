// Test helper: writes a narrator SceneMessage directly, bypassing the AI, so UI features that read narrator
// bubbles (e.g. the "Escuchar" text-to-speech button) can be verified without a real OpenRouter call.
// Usage: npx tsx scripts/force-scene-message.ts <characterId> "<text>"
import { prisma } from "../src/lib/db";

async function main() {
  const [characterId, text] = process.argv.slice(2);
  if (!characterId || !text) throw new Error('Usage: force-scene-message.ts <characterId> "<text>"');

  await prisma.sceneMessage.create({ data: { characterId, role: "narrator", text } });
  console.log("Forced narrator SceneMessage for", characterId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
