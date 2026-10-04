// Test helper: sets a character's Haki / fruit mastery directly and clears the training cooldown, so the training
// focus selector can be driven deterministically in a browser check. Prints the values back as JSON.
// Usage: npx tsx scripts/set-training-state.ts <characterId> [armament] [observation] [fruitMastery] [level]
//        npx tsx scripts/set-training-state.ts <characterId> --show
// Values above the level cap are written raw; the next character GET banks the excess (game/progression-caps.ts).
import { prisma } from "../src/lib/db";

async function main() {
  const [id, a, o, f, lvl] = process.argv.slice(2);
  if (!id) throw new Error("Usage: set-training-state.ts <characterId> [armament] [observation] [fruitMastery] [level] | --show");
  if (a !== "--show") {
    await prisma.character.update({
      where: { id },
      data: {
        lastTrainedAt: null,
        stamina: 100,
        staminaUpdatedAt: new Date(),
        ...(a !== undefined ? { armamentHaki: Number(a) } : {}),
        ...(o !== undefined ? { observationHaki: Number(o) } : {}),
        ...(f !== undefined ? { fruitMastery: Number(f) } : {}),
        ...(lvl !== undefined ? { level: Number(lvl), bankedArmament: 0, bankedObservation: 0, bankedFruit: 0 } : {}),
      },
    });
  }
  const c = await prisma.character.findUniqueOrThrow({
    where: { id },
    select: { level: true, armamentHaki: true, observationHaki: true, fruitMastery: true, bankedArmament: true, bankedObservation: true, bankedFruit: true, lastTrainedAt: true },
  });
  console.log(JSON.stringify(c));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
