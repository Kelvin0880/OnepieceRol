// Attributes + inventory against the dev DB: lazy point grants, spending (incl. a double-spend race),
// bag stacking, use/sell/buy rules, several weapons per character, loot. Usage: npx tsx scripts/attributes-inventory-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { DEVIL_FRUIT_CATALOG } from "../src/lib/game/devil-fruit-catalog";
import { syncAttributePoints, spendAttributePoints, AttributeError } from "../src/lib/game/attributes";
import { grantItem, getInventoryView, useInventoryItem, sellInventoryItem, buyInventoryItem, InventoryError, grantLoot, grantCatalogFruit, eatFruit, sellFruit, grantWeapon } from "../src/lib/game/inventory";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>, cls: new (...a: never[]) => Error) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof cls;
  }
}

async function main() {
  const isl = await prisma.island.findFirstOrThrow({ where: { name: "Pueblo Foosha" } });
  const u = await prisma.user.create({ data: { username: `ai${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const c = await prisma.character.create({
    data: { name: `Atrib${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: isl.id, hp: 60, maxHp: 100, berries: 10_000, strength: 8, agility: 9, durability: 6, willpower: 5, intellect: 4 },
  });

  // ---- attributes
  assert((await syncAttributePoints(c.id)) === 0, "level 1 has no points");
  await prisma.character.update({ where: { id: c.id }, data: { level: 4 } });
  assert((await syncAttributePoints(c.id)) === 6, "reaching level 4 grants 3 levels x 2 points");
  assert((await syncAttributePoints(c.id)) === 6, "syncing again grants nothing more (idempotent)");
  const [a, b] = await Promise.all([syncAttributePoints(c.id), syncAttributePoints(c.id)]);
  assert(a === 6 && b === 6, "two concurrent syncs never double-grant");

  assert(await rejects(() => spendAttributePoints(c.id, u.id, { strength: 7 }), AttributeError), "cannot spend more than owned");
  assert(await rejects(() => spendAttributePoints(c.id, "someone-else", { strength: 1 }), AttributeError), "cannot spend someone else's points");
  assert(await rejects(() => spendAttributePoints(c.id, u.id, { strength: 1.5 } as never), AttributeError), "rejects fractions");
  const r = await spendAttributePoints(c.id, u.id, { durability: 2, willpower: 1, strength: 1 });
  assert(r.spent === 4 && r.remaining === 2, "spending reports what is left");
  const after = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
  assert(after.strength === 9 && after.durability === 8 && after.willpower === 6, "attributes went up");
  assert(after.maxHp === 106 && after.hp === 66, "durability raises max HP (and current HP by the same amount)");
  assert(after.maxStamina === 102, "willpower raises max stamina");
  const race = await Promise.allSettled([spendAttributePoints(c.id, u.id, { agility: 2 }), spendAttributePoints(c.id, u.id, { agility: 2 })]);
  assert(race.filter((x) => x.status === "fulfilled").length === 1, "a double-submit spends the points only once");
  const final = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
  assert(final.agility === 11 && final.attributePoints === 0, "the second submit changed nothing");
  await prisma.character.update({ where: { id: c.id }, data: { level: 1, attrLevelGranted: 1, agility: 9 + 100 } });
  assert(await rejects(() => spendAttributePoints(c.id, u.id, { strength: 1 }), AttributeError), "no points, no spending");

  // ---- inventory
  assert((await getInventoryView(c.id, u.id)).items.length === 0, "the bag starts empty");
  await grantItem(c.id, "vendaje", 8);
  await grantItem(c.id, "vendaje", 3);
  let view = await getInventoryView(c.id, u.id);
  assert(view.items.length === 2 && view.items[0].quantity === 9 && view.items[1].quantity === 2, "stacks fill to 9 and then open a new slot");
  await prisma.character.update({ where: { id: c.id }, data: { hp: 50, maxHp: 100, stamina: 50 } });
  const use = await useInventoryItem(c.id, u.id, "vendaje");
  assert(use.message.includes("+25"), "a bandage heals 25");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).hp === 75, "the HP really changed");
  assert(await rejects(() => useInventoryItem(c.id, u.id, "logpose"), InventoryError), "cannot use something you do not have");
  await grantItem(c.id, "logpose", 1);
  assert(await rejects(() => useInventoryItem(c.id, u.id, "logpose"), InventoryError), "a tool cannot be consumed");
  await prisma.character.update({ where: { id: c.id }, data: { hp: 100 } });
  assert(await rejects(() => useInventoryItem(c.id, u.id, "vendaje"), InventoryError), "healing at full health is refused and nothing is consumed");
  view = await getInventoryView(c.id, u.id);
  assert(view.items.filter((i) => i.id === "vendaje").reduce((n, i) => n + i.quantity, 0) === 10, "the refused use did not consume the bandage");

  const berriesBefore = (await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries;
  const sold = await sellInventoryItem(c.id, u.id, "vendaje", 2);
  assert(sold.message.includes("Vendes 2"), "selling works");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries === berriesBefore + 240, "sale price is 40% of the price per unit");
  assert(await rejects(() => sellInventoryItem(c.id, u.id, "vendaje", 99), InventoryError), "cannot sell more than you have");

  await prisma.character.update({ where: { id: c.id }, data: { berries: 100 } });
  assert(await rejects(() => buyInventoryItem(c.id, u.id, "botiquin"), InventoryError), "cannot buy without berries");
  assert(await rejects(() => buyInventoryItem(c.id, u.id, "reliquia"), InventoryError), "the merchant only sells the shop list");
  await prisma.character.update({ where: { id: c.id }, data: { berries: 50_000 } });
  await buyInventoryItem(c.id, u.id, "botiquin");
  assert(await rejects(() => buyInventoryItem(c.id, u.id, "logpose"), InventoryError), "a second Log Pose is refused");

  // several weapons at once (Weapon.ownerId used to be unique)
  await prisma.weapon.create({ data: { name: "Espada A", kind: "Katana", grade: "NONE", description: "a", atkBonus: 3, basePrice: 1, ownerId: c.id } });
  await prisma.weapon.create({ data: { name: "Espada B", kind: "Katana", grade: "NONE", description: "b", atkBonus: 5, basePrice: 1, ownerId: c.id } });
  assert((await getInventoryView(c.id, u.id)).weapons.length === 2, "a character can own several weapons");

  // pending encounter blocks item use
  await prisma.character.update({ where: { id: c.id }, data: { hp: 50 } });
  await prisma.pendingEncounter.create({ data: { characterId: c.id, enemyJson: JSON.stringify({ name: "X", hp: 10, atk: 1, def: 1, spd: 1 }), rewardsJson: JSON.stringify({ berries: 0, xp: 0, bounty: 0, islandDanger: 1 }), narrative: "n", assessment: "even" } });
  assert(await rejects(() => useInventoryItem(c.id, u.id, "botiquin"), InventoryError), "no items in the middle of a fight");
  await prisma.pendingEncounter.deleteMany({ where: { characterId: c.id } });

  // loot
  let found = 0;
  for (let i = 0; i < 80; i++) if (await grantLoot(c.id, 6, "critical_success")) found++;
  assert(found > 5 && found < 80, `criticals drop loot fairly often (${found}/80) but not always`);

  // fruits: found -> bag -> the player decides
  await prisma.inventoryItem.deleteMany({ where: { characterId: c.id } });
  const commons = DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton);
  const named = await grantCatalogFruit(c.id, commons[0].name);
  assert(!!named, "a common fruit can be granted to the bag by name, and it keeps its name");
  assert((await grantCatalogFruit(c.id, "Nombre inventado")) === null, "an unknown fruit is not invented");
  view = await getInventoryView(c.id, u.id);
  assert(view.fruits.length === 1 && view.fruits[0].name === named, "the fruit shows in the bag with its real name");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).devilFruitId === null, "finding a fruit does NOT eat it");
  await grantItem(c.id, "vendaje", 1);
  assert((await getInventoryView(c.id, u.id)).fruits.length === 1, "rewriting the item stacks never wipes the fruit");
  const second = await grantCatalogFruit(c.id, commons[1].name);
  view = await getInventoryView(c.id, u.id);
  assert(view.fruits.length === (second ? 2 : 1), "several fruits can be carried");
  const eaten = await eatFruit(c.id, u.id, view.fruits[0].inventoryItemId);
  assert(eaten.message.includes(view.fruits[0].name) && eaten.message.includes("nadar"), "eating names the fruit and warns about the sea");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).devilFruitId !== null, "the fruit is now the character's power");
  if (second) {
    view = await getInventoryView(c.id, u.id);
    assert(await rejects(() => eatFruit(c.id, u.id, view.fruits[0].inventoryItemId), InventoryError), "a second fruit cannot be eaten");
    const money = (await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries;
    const sale = await sellFruit(c.id, u.id, view.fruits[0].inventoryItemId);
    assert(sale.message.includes("Vendes") && (await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries > money, "a spare fruit can be sold");
    assert(await rejects(() => sellFruit(c.id, u.id, view.fruits[0].inventoryItemId), InventoryError), "selling the same fruit twice is refused");
  }
  const w = await grantWeapon(c.id, { name: "Cimitarra de premio", kind: "Sable", atkBonus: 9, description: "Premio" });
  assert((await getInventoryView(c.id, u.id)).weapons.some((x) => x.name === w), "a prize weapon lands in the inventory, ready to equip");

  // corrupt rows are ignored, never crash the view
  await prisma.inventoryItem.create({ data: { characterId: c.id, name: "Roto", kind: "x", quantity: 1, effectJson: "{not json" } });
  assert((await getInventoryView(c.id, u.id)).items.every((i) => i.name !== "Roto"), "a corrupt row does not break the inventory");

  console.log("ALL ATTRIBUTE + INVENTORY CHECKS PASSED");
}
main().finally(() => prisma.$disconnect());
