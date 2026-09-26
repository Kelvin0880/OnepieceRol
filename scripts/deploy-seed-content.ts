// Deploy helper (idempotent): upserts the whole devil fruit catalog, links Teach's SECOND fruit and seeds every island resident on
// production, without running the full seed. Uses an isolated Prisma client at .prod-client (see deploy-seed-history-stones.ts).
// Usage: DATABASE_URL="<neon>" npx tsx scripts/deploy-seed-content.ts
import "dotenv/config";
import { createRequire } from "module";
import { DEVIL_FRUIT_CATALOG } from "../src/lib/game/devil-fruit-catalog";
import { seedIslandRoster } from "../src/lib/game/island-npcs";
import { ISLAND_NPC_DATA } from "../src/lib/game/island-npc-data";
import { ISLAND_NPC_DATA_WAVE2 } from "../src/lib/game/island-npc-data-wave2";

async function main() {
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("../.prod-client/index.js");
  const db = new PrismaClient();
  let created = 0;
  let updated = 0;
  for (const f of DEVIL_FRUIT_CATALOG) {
    const data = { englishName: f.englishName, type: f.type, rarity: f.rarity, description: f.description, effectsJson: JSON.stringify(f.effects), isSingleton: f.isSingleton };
    const existing = await db.devilFruit.findFirst({ where: { name: f.name }, orderBy: { createdAt: "asc" } });
    if (existing) {
      await db.devilFruit.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.devilFruit.create({ data: { name: f.name, ...data } });
      created++;
    }
  }
  console.log(`fruits: ${created} created, ${updated} updated (${DEVIL_FRUIT_CATALOG.length} in catalog)`);
  const gura = await db.devilFruit.findFirst({ where: { name: "Gura Gura no Mi" }, orderBy: { createdAt: "asc" } });
  const teach = await db.worldActor.findUnique({ where: { name: "Marshall D. Teach" } });
  if (gura && teach) {
    const owner = await db.worldActor.findFirst({ where: { OR: [{ devilFruitId: gura.id }, { secondDevilFruitId: gura.id }], NOT: { id: teach.id } }, select: { name: true } });
    if (owner) console.log(`Gura Gura is held by ${owner.name}: left alone`);
    else {
      await db.worldActor.update({ where: { id: teach.id }, data: { secondDevilFruitId: gura.id } });
      console.log("Marshall D. Teach now holds Yami Yami + Gura Gura");
    }
  }
  console.log(`residents seeded/updated: ${await seedIslandRoster([...ISLAND_NPC_DATA, ...ISLAND_NPC_DATA_WAVE2], db)}`);
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
