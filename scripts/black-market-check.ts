// Black market against the dev DB: state only on lawless islands, purchases apply their effect,
// stings happen. Usage: npx tsx scripts/black-market-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getBlackMarketState, buyFromBlackMarket, BlackMarketError } from "../src/lib/game/black-market";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  const town = await prisma.island.findFirstOrThrow({ where: { name: "Loguetown" } });
  const calm = await prisma.island.findFirstOrThrow({ where: { name: "Isla Conomi" } });
  const u = await prisma.user.create({ data: { username: `bm${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const c = await prisma.character.create({ data: { name: `Truhan${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: calm.id, hp: 100, maxHp: 100, berries: 5_000_000, bounty: 50_000_000, poneglyphHeat: 100 } });

  assert((await getBlackMarketState(c.id)) === null, "no market on a calm island");
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: town.id } });
  const state = await getBlackMarketState(c.id);
  assert(!!state && state.offers.length === 3, "Loguetown shows three offers");

  let stings = 0;
  let applied = 0;
  for (let i = 0; i < 40; i++) {
    const fresh = await getBlackMarketState(c.id);
    const offer = fresh!.offers[i % fresh!.offers.length];
    await prisma.character.update({ where: { id: c.id }, data: { berries: 5_000_000, hp: 100, devilFruitId: null } });
    const before = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
    const r = await buyFromBlackMarket(c.id, u.id, offer.id as never);
    const after = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
    assert(after.berries === before.berries - offer.price, "the price is always paid");
    if (r.sting) {
      stings++;
      assert(after.hp >= 1 && after.hp < before.hp, "a sting hurts but never kills");
    } else applied++;
  }
  assert(stings > 0 && applied > 0, `both stings (${stings}) and clean deals (${applied}) occur`);

  await prisma.character.update({ where: { id: c.id }, data: { berries: 0 } });
  let poor = false;
  try {
    await buyFromBlackMarket(c.id, u.id, (await getBlackMarketState(c.id))!.offers[0].id as never);
  } catch (e) {
    poor = e instanceof BlackMarketError;
  }
  assert(poor, "cannot buy without the berries");
  console.log("ALL BLACK MARKET CHECKS PASSED");
}
main().finally(() => prisma.$disconnect());
