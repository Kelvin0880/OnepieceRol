// Test helper (2026-09-24): fabricates a world event in a known state so the UI can be checked without waiting hours.
//   npx tsx scripts/force-world-arc.ts awaiting            -> a capture arc waiting for the owner's verdict (6 chapters published)
//   npx tsx scripts/force-world-arc.ts siege "<Nombre>"    -> an ACTIVE arc at chapter 4 located where character <Nombre> stands
import { prisma } from "../src/lib/db";

async function main() {
  const mode = process.argv[2] ?? "awaiting";
  const characterName = process.argv[3];
  await prisma.worldArc.deleteMany({});
  await prisma.newsItem.deleteMany({ where: { arcId: { not: null } } });
  const target = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Eustass Kid" } });
  const aggressor = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Smoker" } });
  const foosha = await prisma.island.findFirstOrThrow({ where: { name: "Pueblo Foosha" } });
  let placeId = foosha.id;
  let placeName = foosha.name;
  if (characterName) {
    const c = await prisma.character.findFirstOrThrow({ where: { name: characterName }, include: { currentIsland: true } });
    placeId = c.currentIslandId;
    placeName = c.currentIsland.name;
  }
  const stage = mode === "awaiting" ? 6 : 4;
  const arc = await prisma.worldArc.create({
    data: {
      kind: "capture",
      title: "La caza de Eustass Kid",
      targetActorId: target.id,
      targetName: target.name,
      aggressorId: aggressor.id,
      aggressorName: aggressor.name,
      stage,
      status: mode === "awaiting" ? "AWAITING_CONSENT" : "ACTIVE",
      consent: mode === "awaiting" ? "PENDING" : "NONE",
      nextBeatAt: new Date(Date.now() + 24 * 3600 * 1000),
      contextJson: JSON.stringify(Array.from({ length: stage }, (_, i) => `Capítulo ${i + 1}: suceso número ${i + 1} en ${placeName}`)),
    },
  });
  for (let i = 1; i <= stage; i++) {
    await prisma.newsItem.create({
      data: { headline: `Capítulo ${i}: ${target.name} bajo presión`, body: `Suceso número ${i} de la historia.`, category: "Eventos mundiales", severity: i >= 3 ? "major" : "normal", worldActorId: target.id, locationName: placeName, islandId: placeId, arcId: arc.id, arcStage: i, createdAt: new Date(Date.now() - (stage - i) * 3600 * 1000) },
    });
  }
  console.log(`arc ${arc.id} created (${mode}) at ${placeName}`);
}
main().finally(() => prisma.$disconnect());
