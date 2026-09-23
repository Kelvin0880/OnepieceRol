// Test helper: forces a character straight into a grudge-ambush
// PendingEncounter against Marshall D. Teach's lieutenant (bypassing the
// explore-time probability roll), so the UI can be verified deterministically.
// Usage: npx tsx scripts/force-grudge-ambush.ts <characterId>
import { prisma } from "../src/lib/db";

async function main() {
  const [characterId] = process.argv.slice(2);
  if (!characterId) throw new Error("Usage: force-grudge-ambush.ts <characterId>");

  const teach = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Marshall D. Teach" } });
  const template = await prisma.eventTemplate.findFirstOrThrow({ where: { title: "La guardia personal de Barbanegra" } });
  const enemy = JSON.parse(template.bodyJson).enemy;

  await prisma.grudge.upsert({
    where: { worldActorId_characterId: { worldActorId: teach.id, characterId } },
    create: { worldActorId: teach.id, characterId, heat: 150, lastIncidentNote: "escapó de él en Isla Cementerio", enemyName: enemy.name, enemySnapshotJson: JSON.stringify(enemy) },
    update: { heat: 150, lastIncidentNote: "escapó de él en Isla Cementerio", enemyName: enemy.name, enemySnapshotJson: JSON.stringify(enemy) },
  });

  await prisma.pendingEncounter.deleteMany({ where: { characterId } });
  await prisma.pendingEncounter.create({
    data: {
      characterId,
      enemyJson: JSON.stringify(enemy),
      rewardsJson: JSON.stringify({ berries: 0, xp: 25, bounty: 0, islandDanger: 10 }),
      narrative: `${teach.name} no olvidó lo ocurrido: escapó de él en Isla Cementerio. Uno de sus hombres te encuentra de nuevo.`,
      assessment: "even",
      phase: "threat",
    },
  });
  console.log("Forced grudge-ambush PendingEncounter for", characterId, "against", enemy.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
