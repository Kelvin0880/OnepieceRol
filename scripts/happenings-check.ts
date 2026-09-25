// One AI-invented happening per 24 h, against the dev DB (needs a seeded DB) and the real model.
// Usage: npx tsx scripts/happenings-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { tickWorldHappenings, recentHappeningsFor } from "../src/lib/game/world-happenings";
import { HAPPENING_CATEGORY } from "../src/lib/engine/world-happenings";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  await prisma.newsItem.deleteMany({ where: { category: HAPPENING_CATEGORY } });
  assert((await tickWorldHappenings()) === true, "the first tick publishes a happening");
  const first = await prisma.newsItem.findFirstOrThrow({ where: { category: HAPPENING_CATEGORY } });
  console.log(`  -> ${first.locationName}: ${first.headline}\n  ${first.body.slice(0, 300)}`);
  assert(!!first.islandId && !!first.locationName, "it has a real island and place");
  assert(first.body.length >= 60, "the body is a real news text");
  assert((await tickWorldHappenings()) === false, "a second tick inside 24 h publishes nothing");
  assert((await prisma.newsItem.count({ where: { category: HAPPENING_CATEGORY } })) === 1, "still exactly one");
  const ctx = await recentHappeningsFor(first.islandId!);
  assert(ctx.length === 1, "the narrator context sees the happening for that island");
  await prisma.newsItem.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
  assert((await tickWorldHappenings()) === true, "25 h later the next one is published");
  const second = await prisma.newsItem.findMany({ where: { category: HAPPENING_CATEGORY }, orderBy: { createdAt: "desc" } });
  assert(second.length === 2 && second[0].headline !== second[1].headline, "and it is a different one");
  console.log(`  -> ${second[0].locationName}: ${second[0].headline}`);
  await prisma.newsItem.deleteMany({ where: { category: HAPPENING_CATEGORY } });
  console.log("ALL PASS");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
