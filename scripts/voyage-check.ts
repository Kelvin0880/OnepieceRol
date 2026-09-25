// Long voyages and the Yonko tool against the dev DB (needs a seeded DB: npm run db:reset).
// Usage: npx tsx scripts/voyage-check.ts
import "dotenv/config";
import { execSync } from "child_process";
import { prisma } from "../src/lib/db";
import { travelCharacter, restCharacter, exploreCharacter, GameActionError } from "../src/lib/game/perform-action";
import { getVoyageOptions, getVoyageView, settleVoyage } from "../src/lib/game/voyage";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>, part?: string) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof GameActionError && (!part || e.message.includes(part));
  }
}

async function main() {
  const foosha = await prisma.island.findFirstOrThrow({ where: { name: { contains: "Foosha" } } });
  const mk = async (name: string, level: number) => {
    const u = await prisma.user.create({ data: { username: `vy${Math.floor(Math.random() * 1e9)}`, passwordHash: "x" } });
    const c = await prisma.character.create({ data: { name: `${name}${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: foosha.id, level, hp: 200, maxHp: 200 } });
    return { u, c };
  };
  const toro = await prisma.island.findFirstOrThrow({ where: { name: "Isla del Toro Negro" } });
  assert(toro.minLevelToEnter === 30, "the Black Bull island exists in the seeded world");
  const links = JSON.parse(toro.connections) as string[];
  assert(links.length === 2, "it hangs off Elbaf and Dressrosa in the New World");

  // ---- low level: neighbours only
  const rookie = await mk("Novato", 5);
  const far = await prisma.island.findFirstOrThrow({ where: { name: "Loguetown" } });
  assert(await rejects(() => travelCharacter(rookie.c.id, rookie.u.id, far.id), "nivel 20"), "a low-level character cannot sail to a distant island, and is told when it unlocks");
  assert((await getVoyageOptions(rookie.c.id)).canSailAnywhere === false, "the menu is closed below level 20");

  // ---- high level: the menu and the crossing
  const cap = await mk("Capitan", 35);
  const menu = await getVoyageOptions(cap.c.id);
  assert(menu.canSailAnywhere && menu.from.includes("Foosha"), "the menu knows where you are");
  const wano = menu.options.find((o) => o.name.includes("Wano"))!;
  assert(wano.hops > 3 && wano.durationMs > 15 * 60_000 && wano.risk > 20, `a far island takes long and is risky (${wano.hops} hops, ${Math.round(wano.durationMs / 60000)} min, ${wano.risk}%)`);
  assert(menu.options.every((o, i, a) => i === 0 || a[i - 1].hops <= o.hops), "the menu is sorted nearest first");
  const laugh = menu.options.find((o) => o.name === "Laugh Tale");
  assert(!laugh || !!laugh.blocked, "Laugh Tale stays closed without the Road Poneglyphs");
  const toroOpt = menu.options.find((o) => o.name === "Isla del Toro Negro");
  assert(!!toroOpt && !toroOpt.blocked, "the Black Bull island is a valid destination at level 35");
  const near = menu.options.find((o) => o.hops === 1)!;
  assert(near.durationMs === 0 && near.risk === 0, "a neighbour is a direct, safe crossing");

  const dest = menu.options.find((o) => o.hops >= 3 && !o.blocked)!;
  const res = await travelCharacter(cap.c.id, cap.u.id, dest.islandId);
  assert(res.log[0].includes("rumbo a"), "sailing far starts a voyage");
  const at = await prisma.character.findUniqueOrThrow({ where: { id: cap.c.id } });
  assert(at.currentIslandId === foosha.id && !!at.voyageArrivesAt, "still at the origin until the ship arrives");
  assert(!!(await getVoyageView(cap.c.id)), "the state shows the crossing");
  assert(await rejects(() => restCharacter(cap.c.id, cap.u.id), "alta mar"), "you cannot rest at sea");
  assert(await rejects(() => exploreCharacter(cap.c.id, cap.u.id), "alta mar"), "you cannot explore at sea");
  assert(await rejects(() => travelCharacter(cap.c.id, cap.u.id, near.islandId), "alta mar"), "you cannot sail again mid-crossing");
  assert((await settleVoyage(cap.c.id)) === null, "the ship has not arrived yet");

  // ---- arrival, clean
  await prisma.character.update({ where: { id: cap.c.id }, data: { voyageArrivesAt: new Date(Date.now() - 1000), voyageAmbushJson: null } });
  const landed = await settleVoyage(cap.c.id);
  assert(landed?.landedAt === dest.name, "the crossing ends on the chosen island");
  const after = await prisma.character.findUniqueOrThrow({ where: { id: cap.c.id }, include: { pendingEncounter: true } });
  assert(after.currentIslandId === dest.islandId && !after.voyageArrivesAt && !after.pendingEncounter, "arrived, no voyage state left, no ambush");
  assert((await settleVoyage(cap.c.id)) === null, "settling twice does nothing");
  assert(JSON.parse(after.islandsVisited).includes(dest.islandId), "the island is marked as visited");

  // ---- arrival with an ambush: a real fight waits at the harbour
  await prisma.character.update({ where: { id: cap.c.id }, data: { voyageToIslandId: near.islandId, voyageFromIslandId: dest.islandId, voyageArrivesAt: new Date(Date.now() - 1000), voyageAmbushJson: JSON.stringify({ name: "Patrulla de la Marina", blurb: "Una patrulla te cierra el paso.", power: 1.2 }), lastTravelAt: null } });
  const amb = await settleVoyage(cap.c.id);
  assert(!!amb && amb.log.some((l) => l.includes("patrulla")), "the ambush is announced on arrival");
  const pe = await prisma.pendingEncounter.findUniqueOrThrow({ where: { characterId: cap.c.id } });
  assert((JSON.parse(pe.enemyJson) as { name: string }).name === "Patrulla de la Marina" && pe.phase === "threat", "a real pending fight was created");
  assert(await rejects(() => travelCharacter(cap.c.id, cap.u.id, dest.islandId), "sin resolver"), "you cannot sail off with the ambush unresolved");

  // ---- Yonko tool
  const yon = await mk("Kirito", 2);
  execSync(`npx tsx scripts/make-yonko.ts "${yon.c.name}"`, { encoding: "utf8" });
  const y = await prisma.character.findUniqueOrThrow({ where: { id: yon.c.id }, include: { devilFruit: true, companions: true, styles: true, crew: true, equippedWeapon: true, ownedWeapons: true } });
  assert(y.level >= 45 && y.strength === 147 && y.agility === 147 && y.willpower === 147, "all attributes are at the cap for the level");
  assert(y.observationHaki === 100 && y.armamentHaki === 100 && y.conquerorsHaki, "all three Haki");
  assert(y.devilFruit?.name === "Ope Ope no Mi" && y.fruitAwakened && y.fruitMastery === 100, "an awakened copy of the Ope Ope no Mi");
  const law = await prisma.worldActor.findFirst({ where: { name: { contains: "Law" } }, include: { devilFruit: true } });
  assert(!law || law.devilFruitId !== y.devilFruitId, "Law keeps his own fruit row (a copy, not a steal)");
  assert(y.styles.some((s) => s.styleId === "nitoryu" && s.mastery === 100) && y.ownedWeapons.length === 2, "Nitoryu at grand-master and two blades");
  assert(y.bounty === 2_000_000_000 && y.title === "Yonko de Isla del Toro Negro", "Yonko bounty and title");
  assert(y.currentIslandId === toro.id, "he is placed on his own island");
  assert(y.companions.length === 3 && y.companions.every((n) => !!n.profileJson), "three named commanders with profiles");
  const t = await prisma.territory.findUniqueOrThrow({ where: { islandId: toro.id } });
  assert(t.ownerCharacterId === y.id && t.garrison === 100, "the island is his territory with a full garrison");
  execSync(`npx tsx scripts/make-yonko.ts "${yon.c.name}"`, { encoding: "utf8" });
  const y2 = await prisma.character.findUniqueOrThrow({ where: { id: y.id }, include: { companions: true, ownedWeapons: true } });
  assert(y2.maxHp === y.maxHp && y2.companions.length === 3 && y2.ownedWeapons.length === 2, "running the tool twice changes nothing (idempotent)");

  // ---- a Yonko's crossings are world news
  const yonMenu = await getVoyageOptions(y.id);
  const yDest = yonMenu.options.find((o) => o.hops >= 2 && !o.blocked)!;
  await prisma.character.update({ where: { id: y.id }, data: { lastTravelAt: null } });
  await travelCharacter(y.id, yon.u.id, yDest.islandId);
  const news = await prisma.newsItem.findFirst({ where: { characterId: y.id, headline: { contains: "zarpa" } } });
  assert(!!news && news.severity === "major" && news.locationName!.startsWith("En el mar"), "a Yonko leaving port is major news located at sea");

  console.log("ALL VOYAGE CHECKS PASSED");
}
main().finally(() => prisma.$disconnect());
