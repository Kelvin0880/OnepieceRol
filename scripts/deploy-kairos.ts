// Adds Isla Kairos (2026-10-04) to an already-seeded world without reseeding anything else: the island itself,
// its routes (appended both ways, never rewriting another island's other connections), its residents and its
// explore stories. Idempotent: safe to run twice. Production: run with an inline DATABASE_URL against the postgres
// client (see CLAUDE.md "Deployment"), never store the URL. Usage: npx tsx scripts/deploy-kairos.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { KAIROS_ISLAND, KAIROS_ADJACENCY, KAIROS_STORIES, KAIROS_RESIDENTS } from "../src/lib/game/islands-kairos";
import { seedIslandRoster } from "../src/lib/game/island-npcs";

// The same keys the seed uses (prisma/seed.ts islandDefs), only for the islands Kairos touches.
const KEY_TO_NAME: Record<string, string> = { whiskyPeak: "Whisky Peak", littleGarden: "Little Garden", drum: "Isla Drum" };

async function main() {
  const d = KAIROS_ISLAND;
  const island = await prisma.island.upsert({
    where: { name: d.name },
    update: {},
    create: { name: d.name, sea: d.sea, dangerLevel: d.danger, minLevelToEnter: d.minLevel, factionControl: d.factionControl, description: d.description, arcHook: d.arcHook, connections: "[]" },
  });
  console.log("island:", island.name, island.id);

  for (const key of KAIROS_ADJACENCY.kairos) {
    const name = KEY_TO_NAME[key];
    const other = await prisma.island.findUniqueOrThrow({ where: { name } });
    const otherConn = JSON.parse(other.connections) as string[];
    if (!otherConn.includes(island.id)) await prisma.island.update({ where: { id: other.id }, data: { connections: JSON.stringify([...otherConn, island.id]) } });
    const mine = JSON.parse((await prisma.island.findUniqueOrThrow({ where: { id: island.id } })).connections) as string[];
    if (!mine.includes(other.id)) await prisma.island.update({ where: { id: island.id }, data: { connections: JSON.stringify([...mine, other.id]) } });
    console.log("route:", d.name, "<->", name);
  }

  console.log("residents:", await seedIslandRoster(KAIROS_RESIDENTS, prisma));

  await prisma.eventTemplate.deleteMany({ where: { islandId: island.id } });
  for (const st of KAIROS_STORIES) {
    const outcome = (text: string, extra: object = {}) => ({ text: [text], ...extra });
    await prisma.eventTemplate.create({
      data: {
        islandId: island.id,
        kind: st.kind,
        minDanger: st.min,
        maxDanger: st.max,
        weight: st.weight,
        title: st.title,
        bodyJson: JSON.stringify({
          flavorTexts: [st.flavor],
          onCriticalSuccess: outcome(st.crit, { ...(st.loot ? { berries: [st.loot[0] * 2, st.loot[1] * 2] } : {}), ...(st.xp ? { xp: [st.xp[0] * 2, st.xp[1] * 2] } : {}) }),
          onSuccess: outcome(st.ok, { ...(st.loot ? { berries: st.loot } : {}), ...(st.xp ? { xp: st.xp } : {}) }),
          onFail: outcome(st.fail, st.hurt ? { hpLoss: [0, Math.max(2, Math.floor(st.hurt[1] / 2))] } : {}),
          onCriticalFail: outcome(st.critFail, st.hurt ? { hpLoss: [st.hurt[1], st.hurt[1] * 2] } : {}),
          ...(st.enemy ? { enemy: { ...st.enemy, isBoss: false } } : {}),
        }),
      },
    });
  }
  console.log("stories:", KAIROS_STORIES.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
