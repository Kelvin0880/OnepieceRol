// World expansion check (2026-09-24): new islands wired, Road Poneglyphs placed, territories seeded.
// Usage: npx tsx scripts/verify-world-expansion.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const islands = await prisma.island.findMany();
  assert(islands.length === 26, `26 islands seeded (${islands.length})`);
  const byName = new Map(islands.map((i) => [i.name, i]));
  const conns = (n: string) => new Set(JSON.parse(byName.get(n)!.connections) as string[]);

  // Every connection is symmetric (no one-way sea lanes).
  let asymmetric = 0;
  for (const i of islands) for (const c of JSON.parse(i.connections) as string[]) if (!conns(islands.find((x) => x.id === c)!.name).has(i.id)) asymmetric++;
  assert(asymmetric === 0, "all sea lanes are two-way");

  // The whole map is one connected graph from the start islands.
  const seen = new Set<string>();
  const stack = [byName.get("Pueblo Foosha")!.id];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of JSON.parse(islands.find((x) => x.id === id)!.connections) as string[]) stack.push(c);
  }
  assert(seen.size === islands.length, "every island is reachable from the pirate start");

  assert(byName.get("Isla Abismo")!.tidal === true, "Isla Abismo is tidal");
  assert(byName.get("Laugh Tale")!.requiresRoadPoneglyphs === true, "Laugh Tale needs the four Road Poneglyphs");

  const road = await prisma.poneglyph.findMany({ where: { kind: "Road" }, include: { island: true } });
  assert(road.length === 4, "there are exactly 4 Road Poneglyphs");
  assert(road.every((p) => !!p.island), `all 4 Road Poneglyphs are placed on an island (${road.map((p) => p.island?.name).join(", ")})`);

  const bosses = await prisma.eventTemplate.findMany({ where: { kind: "BOSS" } });
  const guardians = bosses.filter((b) => JSON.parse(b.bodyJson).poneglyphId);
  assert(guardians.length === 4, "each Road Poneglyph has a guardian boss event");
  for (const g of guardians) assert(!!JSON.parse(g.bodyJson).enemy.worldActorId, `${g.title} is tied to a WorldActor holder`);

  const territories = await prisma.territory.findMany();
  assert(territories.length === 8, `8 conquerable territories (${territories.length})`);
  assert((await prisma.worldActor.count({ where: { role: "GOROSEI" } })) === 1, "a Gorosei actor exists");
  const singletons = await prisma.devilFruit.count({ where: { isSingleton: true } });
  assert(singletons >= 23, `singleton fruits seeded (${singletons})`);
  const eneru = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Eneru" }, include: { devilFruit: true } });
  assert(eneru.devilFruit?.name === "Goro Goro no Mi", "Eneru holds the Goro Goro no Mi");
  const stories = await prisma.eventTemplate.count({ where: { islandId: { not: null } } });
  assert(stories >= 27, `island-specific beats seeded (${stories})`);
  console.log("ALL PASS");
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
