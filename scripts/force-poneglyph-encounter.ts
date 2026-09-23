// Test helper: forces a character straight into the "victory" phase of a
// specific boss's PendingEncounter (bypassing exploration RNG) so the
// spare/finish -> Poneglyph grant path can be verified deterministically.
// Usage: npx tsx scripts/force-poneglyph-encounter.ts <characterId> <islandKey: graveyardIsland|eniesLobby>
import { prisma } from "../src/lib/db";

const BOSS_BY_ISLAND: Record<string, { title: string; enemy: object }> = {
  graveyardIsland: {
    title: "La guardia personal de Barbanegra",
    enemy: { name: "Lugarteniente de Barbanegra", hp: 320, atk: 78, def: 55, spd: 42, isBoss: true },
  },
  eniesLobby: {
    title: "El escuadrón de CP-0",
    enemy: { name: "Agente de CP-0", hp: 300, atk: 82, def: 50, spd: 60, isBoss: true },
  },
};

async function main() {
  const [characterId, islandKey] = process.argv.slice(2);
  if (!characterId || !islandKey || !BOSS_BY_ISLAND[islandKey]) {
    throw new Error("Usage: force-poneglyph-encounter.ts <characterId> <graveyardIsland|eniesLobby>");
  }

  const boss = BOSS_BY_ISLAND[islandKey];
  const template = await prisma.eventTemplate.findFirst({ where: { title: boss.title } });
  if (!template) throw new Error(`No event template found for "${boss.title}"`);
  const body = JSON.parse(template.bodyJson);
  if (!body.poneglyphId) throw new Error(`Event template "${boss.title}" has no poneglyphId wired`);

  await prisma.pendingEncounter.deleteMany({ where: { characterId } });
  await prisma.pendingEncounter.create({
    data: {
      characterId,
      enemyJson: JSON.stringify(boss.enemy),
      rewardsJson: JSON.stringify({ berries: 50000, xp: 100, bounty: 20000000, islandDanger: 10, poneglyphId: body.poneglyphId }),
      narrative: "[forced for testing]",
      assessment: "even",
      phase: "victory",
    },
  });
  console.log("Forced victory-phase PendingEncounter for", characterId, "against", boss.enemy);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
