import { prisma } from "../db";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";
import { liveRng } from "../engine/rng";
import { fruitBlackMarketPrice } from "../engine/economy";
import { INVENTORY_SLOTS } from "../engine/inventory";
import {
  ITEM_CATALOG,
  addToInventory,
  describeInventory,
  getItemDef,
  removeOne,
  rollLoot,
  specialtyIdsFor,
  sellValue,
  useItem,
  type Stack,
} from "../engine/inventory";

export class InventoryError extends Error {}

/** Items sold in any port. Dangerous islands charge more; a fair profit for whoever hauls them. */
export const SHOP_ITEM_IDS = ["vendaje", "racion", "sake", "botiquin", "logpose", "denden", "elixir"];

/** The common stock plus whatever the island is known for. */
export function shopIdsFor(islandName: string): string[] {
  return [...SHOP_ITEM_IDS, ...specialtyIdsFor(islandName)];
}

export function shopPrice(basePrice: number, danger: number): number {
  return Math.round(basePrice * (1 + Math.max(0, danger - 1) * 0.06));
}

async function loadStacks(characterId: string): Promise<Stack[]> {
  const rows = await prisma.inventoryItem.findMany({ where: { characterId }, orderBy: { createdAt: "asc" } });
  const out: Stack[] = [];
  for (const r of rows) {
    const id = safeId(r.effectJson);
    if (id) out.push({ id, quantity: r.quantity });
  }
  return out;
}

function safeId(effectJson: string | null): string | null {
  if (!effectJson) return null;
  try {
    const v = JSON.parse(effectJson) as { id?: unknown };
    return typeof v.id === "string" && getItemDef(v.id) ? v.id : null;
  } catch {
    return null;
  }
}

async function saveStacks(characterId: string, stacks: Stack[]): Promise<void> {
  // Only the catalog rows are rewritten: fruit rows (effectJson.fruitId) are separate one-of-a-kind items.
  const rows = await prisma.inventoryItem.findMany({ where: { characterId }, select: { id: true, effectJson: true } });
  const catalogRowIds = rows.filter((r) => safeId(r.effectJson)).map((r) => r.id);
  await prisma.$transaction([
    prisma.inventoryItem.deleteMany({ where: { id: { in: catalogRowIds } } }),
    ...stacks.map((s, i) => {
      const def = getItemDef(s.id)!;
      return prisma.inventoryItem.create({
        data: { characterId, name: def.name, kind: def.kind, quantity: s.quantity, effectJson: JSON.stringify({ id: s.id }), createdAt: new Date(Date.now() + i) },
      });
    }),
  ]);
}

async function fruitRowCount(characterId: string): Promise<number> {
  const rows = await prisma.inventoryItem.findMany({ where: { characterId }, select: { effectJson: true } });
  return rows.filter((r) => fruitIdOf(r.effectJson)).length;
}

function fruitIdOf(effectJson: string | null): string | null {
  if (!effectJson) return null;
  try {
    const v = JSON.parse(effectJson) as { fruitId?: unknown };
    return typeof v.fruitId === "string" ? v.fruitId : null;
  } catch {
    return null;
  }
}

/** Puts an (unowned) Devil Fruit row in the bag as its own item. False when the bag is full. */
export async function storeFruitInBag(characterId: string, fruit: { id: string; name: string }): Promise<boolean> {
  const used = (await loadStacks(characterId)).length + (await fruitRowCount(characterId));
  if (used >= INVENTORY_SLOTS) return false;
  await prisma.inventoryItem.create({ data: { characterId, name: fruit.name, kind: "Fruta del Diablo", quantity: 1, effectJson: JSON.stringify({ fruitId: fruit.id }) } });
  return true;
}

/** Eating is permanent and exclusive: one fruit per person, and the sea rejects you from then on. */
export async function eatFruit(characterId: string, userId: string, inventoryItemId: string) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== "ALIVE") throw new InventoryError("No puedes comer en tu estado actual.");
  if (c.devilFruitId) throw new InventoryError("Ya cargas con el poder de una Fruta del Diablo: comer una segunda te mataría. Guárdala, véndela o regálala.");
  const row = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  const fruitId = row && row.characterId === characterId ? fruitIdOf(row.effectJson) : null;
  if (!row || !fruitId) throw new InventoryError("Esa fruta no está en tu mochila.");
  const fruit = await prisma.devilFruit.findUnique({ where: { id: fruitId } });
  if (!fruit) throw new InventoryError("Esa fruta ya no existe.");
  // The delete is the guard against a double click: only the request that removes the row gets to eat it.
  const gone = await prisma.inventoryItem.deleteMany({ where: { id: row.id } });
  if (gone.count === 0) throw new InventoryError("Esa fruta ya no está en tu mochila.");
  await prisma.character.update({ where: { id: characterId }, data: { devilFruitId: fruit.id } });
  const message = `Muerdes la ${fruit.name}. Sabe fatal, pero lo sientes: un poder nuevo recorre tu cuerpo. El mar te rechaza para siempre: nunca más podrás nadar.`;
  await prisma.gameLogEntry.create({ data: { characterId, kind: "item", text: message } });
  const { postNews } = await import("./death-resolution");
  await postNews(`¡${c.name} despierta el poder de la ${fruit.name}!`, "Un poder que pocos podrán igualar acaba de entrar en juego en los mares.", "Frutas", characterId);
  return { message };
}

async function ownedCharacter(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.userId !== userId) throw new InventoryError("Personaje no encontrado.");
  return c;
}

/** Adds an item, reporting the outcome as a log line (or null when the bag is full). Never throws: loot is a bonus, not a failure. */
export async function grantItem(characterId: string, itemId: string, quantity = 1): Promise<string | null> {
  const def = getItemDef(itemId);
  if (!def) return null;
  const add = addToInventory(await loadStacks(characterId), itemId, quantity);
  if (add.ok && add.stacks.length + (await fruitRowCount(characterId)) > INVENTORY_SLOTS) return `Encuentras ${def.name}, pero la mochila está llena y lo dejas atrás.`;
  if (!add.ok) return `Encuentras ${def.name}, pero la mochila está llena y lo dejas atrás.`;
  await saveStacks(characterId, add.stacks);
  return `Encuentras ${def.name}${quantity > 1 ? ` x${quantity}` : ""} y lo guardas en la mochila.`;
}

export async function grantLoot(characterId: string, danger: number, outcome: "success" | "critical_success"): Promise<string | null> {
  try {
    const drop = rollLoot(liveRng(), danger, outcome);
    return drop ? await grantItem(characterId, drop.id, drop.quantity) : null;
  } catch {
    return null;
  }
}

export async function getInventoryView(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({
    where: { id: characterId },
    include: { ownedWeapons: true, devilFruit: true, currentIsland: true, companions: true },
  });
  if (!c || c.userId !== userId) throw new InventoryError("Personaje no encontrado.");
  const stacks = await loadStacks(characterId);
  const fruitRows = (await prisma.inventoryItem.findMany({ where: { characterId }, orderBy: { createdAt: "asc" } })).filter((r) => fruitIdOf(r.effectJson));
  const fruitDefs = await prisma.devilFruit.findMany({ where: { id: { in: fruitRows.map((r) => fruitIdOf(r.effectJson)!) } } });
  return {
    berries: c.berries,
    slotsUsed: stacks.length + fruitRows.length,
    hasFruit: !!c.devilFruitId,
    fruits: fruitRows.flatMap((r) => {
      const f = fruitDefs.find((d) => d.id === fruitIdOf(r.effectJson));
      return f ? [{ inventoryItemId: r.id, name: f.name, englishName: f.englishName, type: f.type, rarity: f.rarity, description: f.description, sellValue: Math.round(fruitBlackMarketPrice(f.rarity as never) * 0.5) }] : [];
    }),
    slots: 24,
    items: stacks.map((s) => {
      const d = getItemDef(s.id)!;
      return { id: s.id, name: d.name, kind: d.kind, description: d.description, quantity: s.quantity, usable: !!d.effect, sellValue: sellValue(d) };
    }),
    weapons: c.ownedWeapons.map((w) => ({ id: w.id, name: w.name, kind: w.kind, atkBonus: w.atkBonus, description: w.description, equipped: w.id === c.equippedWeaponId })),
    devilFruit: c.devilFruit ? { name: c.devilFruit.name, description: c.devilFruit.description } : null,
    poneglyphsRead: c.poneglyphsRead,
    shop: shopIdsFor(c.currentIsland.name).map((id) => {
      const d = getItemDef(id)!;
      return { id, name: d.name, kind: d.kind, description: d.description, price: shopPrice(d.price, c.currentIsland.dangerLevel), special: !SHOP_ITEM_IDS.includes(id) };
    }),
  };
}

export async function useInventoryItem(characterId: string, userId: string, itemId: string) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== "ALIVE") throw new InventoryError("No puedes usar objetos en tu estado actual.");
  const { assertCalm } = await import("./perform-action"); // dynamic: perform-action imports this module for loot
  await assertCalm(characterId, userId, "usar objetos").catch((e) => {
    throw new InventoryError(e instanceof Error ? e.message : "Ahora no puedes usar objetos.");
  });
  const def = getItemDef(itemId);
  if (!def) throw new InventoryError("Objeto desconocido.");
  const stacks = await loadStacks(characterId);
  const left = removeOne(stacks, itemId);
  if (!left) throw new InventoryError("No tienes ese objeto.");
  const result = useItem(def, { hp: c.hp, maxHp: c.maxHp, stamina: c.stamina, maxStamina: c.maxStamina, heat: c.poneglyphHeat, berries: c.berries });
  if (!result.ok) throw new InventoryError(result.reason);
  await prisma.character.update({
    where: { id: characterId },
    data: { hp: result.state.hp, stamina: result.state.stamina, staminaUpdatedAt: new Date(), poneglyphHeat: result.state.heat, berries: result.state.berries },
  });
  await saveStacks(characterId, left);
  await prisma.gameLogEntry.create({ data: { characterId, kind: "item", text: result.message } });
  return { message: result.message };
}

export async function sellInventoryItem(characterId: string, userId: string, itemId: string, quantity = 1) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== "ALIVE") throw new InventoryError("No puedes comerciar en tu estado actual.");
  const def = getItemDef(itemId);
  if (!def) throw new InventoryError("Objeto desconocido.");
  let stacks = await loadStacks(characterId);
  const have = stacks.filter((s) => s.id === itemId).reduce((n, s) => n + s.quantity, 0);
  if (quantity < 1 || quantity > have) throw new InventoryError("No tienes tantas unidades.");
  for (let i = 0; i < quantity; i++) stacks = removeOne(stacks, itemId)!;
  const earned = sellValue(def) * quantity;
  await prisma.character.update({ where: { id: characterId }, data: { berries: c.berries + earned } });
  await saveStacks(characterId, stacks);
  return { message: `Vendes ${quantity} × ${def.name} por ฿ ${earned.toLocaleString("es-ES")}.` };
}

export async function sellFruit(characterId: string, userId: string, inventoryItemId: string) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== "ALIVE") throw new InventoryError("No puedes comerciar en tu estado actual.");
  const row = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  const fruitId = row && row.characterId === characterId ? fruitIdOf(row.effectJson) : null;
  if (!row || !fruitId) throw new InventoryError("Esa fruta no está en tu mochila.");
  const fruit = await prisma.devilFruit.findUnique({ where: { id: fruitId } });
  if (!fruit) throw new InventoryError("Esa fruta ya no existe.");
  const gone = await prisma.inventoryItem.deleteMany({ where: { id: row.id } });
  if (gone.count === 0) throw new InventoryError("Esa fruta ya no está en tu mochila.");
  const earned = Math.round(fruitBlackMarketPrice(fruit.rarity as never) * 0.5);
  await prisma.character.update({ where: { id: characterId }, data: { berries: c.berries + earned } });
  return { message: `Vendes la ${fruit.name} por ฿ ${earned.toLocaleString("es-ES")}.` };
}

/** A prize or a gift: a fresh, unowned copy of a common catalog fruit goes straight to the bag. Returns the fruit name, or null when it is unknown, unique to a canon character, or the bag is full. */
export async function grantCatalogFruit(characterId: string, fruitName: string): Promise<string | null> {
  const kind = DEVIL_FRUIT_CATALOG.find((f) => f.name === fruitName && !f.isSingleton);
  if (!kind) return null;
  const fruit = await prisma.devilFruit.create({
    data: { name: kind.name, englishName: kind.englishName, type: kind.type, rarity: kind.rarity, description: kind.description, effectsJson: JSON.stringify(kind.effects), isSingleton: false },
  });
  if (await storeFruitInBag(characterId, fruit)) return fruit.name;
  await prisma.devilFruit.delete({ where: { id: fruit.id } });
  return null;
}

/** A prize weapon: a fresh row owned by the winner, equippable from the Inventory. */
export async function grantWeapon(characterId: string, spec: { name: string; kind: string; atkBonus: number; description: string; basePrice?: number }): Promise<string> {
  const w = await prisma.weapon.create({ data: { name: spec.name, kind: spec.kind, grade: "NONE", description: spec.description, atkBonus: spec.atkBonus, basePrice: spec.basePrice ?? 10_000, ownerId: characterId } });
  return w.name;
}

export async function buyInventoryItem(characterId: string, userId: string, itemId: string) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== "ALIVE") throw new InventoryError("No puedes comerciar en tu estado actual.");
  if (!shopIdsFor(c.currentIsland.name).includes(itemId)) throw new InventoryError("Ese mercader no vende eso.");
  const def = getItemDef(itemId)!;
  const price = shopPrice(def.price, c.currentIsland.dangerLevel);
  if (c.berries < price) throw new InventoryError(`Cuesta ฿ ${price.toLocaleString("es-ES")} y no los tienes.`);
  const stacks = await loadStacks(characterId);
  if (def.maxStack === 1 && stacks.some((s) => s.id === itemId)) throw new InventoryError(`Ya llevas ${def.name}.`);
  const add = addToInventory(stacks, itemId, 1);
  if (!add.ok) throw new InventoryError(add.reason);
  await prisma.character.update({ where: { id: characterId }, data: { berries: c.berries - price } });
  await saveStacks(characterId, add.stacks);
  return { message: `Compras ${def.name} por ฿ ${price.toLocaleString("es-ES")}.` };
}

export async function inventoryLineForNarrator(characterId: string): Promise<string> {
  try {
    return describeInventory(await loadStacks(characterId));
  } catch {
    return "";
  }
}

export const ITEM_IDS = ITEM_CATALOG.map((i) => i.id);
