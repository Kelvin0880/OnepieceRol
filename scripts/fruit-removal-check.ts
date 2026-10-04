process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Isla Kairos fruit removal (2026-10-04), against the dev DB: the offer and its price, every refusal leaves the
// character untouched, the ritual takes the fruit and all its mastery for good, can't charge twice, and the next
// fruit eaten starts from zero. Usage: npx tsx scripts/fruit-removal-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getFruitRemovalOffer, removeDevilFruit, FruitRemovalError } from "../src/lib/game/fruit-removal";
import { eatFruit, grantCatalogFruit } from "../src/lib/game/inventory";
import { DEVIL_FRUIT_CATALOG } from "../src/lib/game/devil-fruit-catalog";
import { fruitRemovalPrice, FRUIT_REMOVAL_ISLAND } from "../src/lib/engine/fruit-removal";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "";
  } catch (e) {
    return e instanceof FruitRemovalError ? e.message : `UNEXPECTED ${(e as Error).message}`;
  }
}
const get = (id: string) => prisma.character.findUniqueOrThrow({ where: { id }, include: { devilFruit: true } });

async function main() {
  const kairos = await prisma.island.findUniqueOrThrow({ where: { name: FRUIT_REMOVAL_ISLAND } });
  const drum = await prisma.island.findUniqueOrThrow({ where: { name: "Isla Drum" } });
  assert(kairos.minLevelToEnter === 10 && JSON.parse(kairos.connections).includes(drum.id), "Isla Kairos is seeded in Paradise, level 10, linked to Isla Drum");
  assert((await prisma.islandNpc.count({ where: { islandId: kairos.id } })) >= 10, "and it has its own cast of residents");

  const u = await prisma.user.create({ data: { username: `kai${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const fruit = await prisma.devilFruit.findFirstOrThrow({ where: { isSingleton: false, type: "PARAMECIA", claimedBy: { is: null } } });
  const c = await prisma.character.create({
    data: { name: `Peregrino${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: kairos.id, level: 9, hp: 100, maxHp: 100, berries: 400_000, devilFruitId: fruit.id, fruitMastery: 38, bankedFruit: 5 },
  });
  const price = fruitRemovalPrice({ level: 9, fruitType: "PARAMECIA", awakened: false, singleton: false });

  // ---- the offer
  const offer = await getFruitRemovalOffer(c.id, u.id);
  assert(offer.here && offer.fruitName === fruit.name && offer.price === price && offer.blockedReason === null, `the card offers the ritual for ฿${price}`);

  // ---- every refusal leaves the character exactly as it was
  assert((await refusal(removeDevilFruit(c.id, u.id, "Otra fruta"))).includes("nombre exacto"), "a wrong confirmation name is refused");
  await prisma.character.update({ where: { id: c.id }, data: { berries: 1000 } });
  assert((await refusal(removeDevilFruit(c.id, u.id, fruit.name))).includes("no te alcanza"), "not enough berries is refused");
  await prisma.character.update({ where: { id: c.id }, data: { berries: 400_000, currentIslandId: drum.id } });
  assert((await refusal(removeDevilFruit(c.id, u.id, fruit.name))).includes(FRUIT_REMOVAL_ISLAND), "anywhere but Isla Kairos is refused");
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: kairos.id } });
  await prisma.pendingEncounter.create({ data: { characterId: c.id, enemyJson: JSON.stringify({ name: "Rata Molo", hp: 80, atk: 10, def: 5, spd: 8 }), rewardsJson: "{}", narrative: "x", assessment: "even" } });
  assert((await refusal(removeDevilFruit(c.id, u.id, fruit.name))).includes("situación sin resolver"), "in the middle of a fight it is refused");
  await prisma.pendingEncounter.delete({ where: { characterId: c.id } });
  let s = await get(c.id);
  assert(s.devilFruitId === fruit.id && s.fruitMastery === 38 && s.berries === 400_000, "after all those refusals nothing was taken");

  // ---- the ritual
  const done = await removeDevilFruit(c.id, u.id, fruit.name);
  s = await get(c.id);
  assert(s.devilFruitId === null && s.fruitMastery === 0 && !s.fruitAwakened && s.bankedFruit === 0, "the fruit and all its mastery (reserve included) are gone");
  assert(s.berries === 400_000 - price, "exactly the price was charged");
  assert(done.message.includes("volver a nadar") || done.message.includes("puedes volver a nadar"), "the player is told they can swim again");
  assert(!!(await prisma.newsItem.findFirst({ where: { characterId: c.id, category: "Frutas", headline: { contains: "renuncia" } } })), "the world hears about it in the news");
  assert((await prisma.devilFruit.findUniqueOrThrow({ where: { id: fruit.id }, include: { claimedBy: true } })).claimedBy === null, "the fruit row is free again (its power returns to the sea)");

  // ---- no double charge
  assert((await refusal(removeDevilFruit(c.id, u.id, fruit.name))).includes("nada que arrancar"), "a second ritual is refused");
  assert((await get(c.id)).berries === 400_000 - price, "and charges nothing");

  // ---- a new fruit starts from zero, even if something stale was left behind
  const newName = DEVIL_FRUIT_CATALOG.find((f) => !f.isSingleton && f.name !== fruit.name)!.name;
  await grantCatalogFruit(c.id, newName);
  await prisma.character.update({ where: { id: c.id }, data: { fruitMastery: 50, bankedFruit: 7 } });
  const bagged = (await prisma.inventoryItem.findMany({ where: { characterId: c.id } })).find((i) => (i.effectJson ?? "").includes("fruit"));
  await eatFruit(c.id, u.id, bagged!.id);
  s = await get(c.id);
  assert(s.devilFruit?.name === newName && s.fruitMastery === 0 && s.bankedFruit === 0 && !s.fruitAwakened, `the next fruit eaten (${newName}) starts from zero`);

  console.log("ALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
