// Targeted, non-destructive seed for an already-running world (no full reseed, so no canon status is ever touched):
// adds the island residents and the canon Impel Down chiefs when they are missing. Usage: DATABASE_URL=... npx tsx scripts/seed-residents.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { ISLAND_NPC_DATA } from "../src/lib/game/island-npc-data";
import { seedIslandRoster } from "../src/lib/game/island-npcs";
import { IMPEL_ACTORS, placeCanonPrisoners } from "../src/lib/game/world-actor-impel";
import { profileStatsJson } from "../src/lib/game/world-actor-profiles";
import { styleAbilityLines } from "../src/lib/engine/actor-styles";

async function main() {
  console.log(`residents: ${await seedIslandRoster(ISLAND_NPC_DATA)}`);
  const islands = new Map((await prisma.island.findMany({ select: { id: true, name: true } })).map((i) => [i.name, i.id]));
  const impel = islands.get("Impel Down") ?? null;
  for (const e of IMPEL_ACTORS) {
    const exists = await prisma.worldActor.findUnique({ where: { name: e.name } });
    if (exists) {
      console.log(`exists: ${e.name} (${exists.status})`);
      continue;
    }
    await prisma.worldActor.create({
      data: {
        name: e.name, role: e.role, personality: e.personality, description: e.description, powerLevel: e.powerLevel,
        factionType: e.factionType, factionName: e.factionName, rankLabel: e.rankLabel, canonBounty: e.canonBounty, canonWeapon: e.canonWeapon,
        statsJson: profileStatsJson(e.profile), abilitiesJson: JSON.stringify([...e.profile.ab, ...styleAbilityLines(e.name)]),
        homeIslandId: impel, currentIslandId: impel, status: "ACTIVE", locationUpdatedAt: new Date(),
      },
    });
    console.log(`created: ${e.name}`);
  }
  console.log(`canon prisoners placed: ${await placeCanonPrisoners(prisma as never)}`);
  console.log(`total residents in db: ${await prisma.islandNpc.count()}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
