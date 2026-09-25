import { prisma } from "../db";
import { WeaponGrade, CharacterStatus } from "@prisma/client";
import {
  isBlackMarketIsland,
  marketWindow,
  msToNextWindow,
  offersForWindow,
  offerPrice,
  stingSprung,
  fruitIsFake,
  stingDamage,
  pardonReduction,
  OfferId,
  MARKET_WINDOW_MS,
} from "../engine/black-market";
import { tryDropFruit } from "./perform-action";

export class BlackMarketError extends Error {}

const seedOf = (name: string) => [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0);

async function dealsThisWindow(characterId: string, nowMs: number) {
  const since = new Date(marketWindow(nowMs) * MARKET_WINDOW_MS);
  return prisma.gameLogEntry.count({ where: { characterId, kind: "blackmarket", createdAt: { gte: since } } });
}

export async function getBlackMarketState(characterId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || !isBlackMarketIsland(c.currentIsland.name)) return null;
  const now = Date.now();
  const offers = offersForWindow(marketWindow(now), seedOf(c.currentIsland.name)).map((o) => ({
    ...o,
    price: offerPrice(o.id, { bounty: c.bounty, notoriety: c.notoriety, faction: c.faction }),
  }));
  return { offers, msToRefresh: msToNextWindow(now), deals: await dealsThisWindow(c.id, now) };
}

const CONTRABAND_BLADE_ATK = 12;

export async function buyFromBlackMarket(characterId: string, userId: string, offerId: OfferId) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.userId !== userId) throw new BlackMarketError("Personaje no encontrado.");
  if (c.status !== CharacterStatus.ALIVE) throw new BlackMarketError("No puedes hacer esto en tu estado actual.");
  if (!isBlackMarketIsland(c.currentIsland.name)) throw new BlackMarketError("Aquí no hay nadie que venda cosas sin preguntas.");
  const now = Date.now();
  const stock = offersForWindow(marketWindow(now), seedOf(c.currentIsland.name));
  if (!stock.some((o) => o.id === offerId)) throw new BlackMarketError("Ese vendedor ya no está.");
  const price = offerPrice(offerId, { bounty: c.bounty, notoriety: c.notoriety, faction: c.faction });
  if (c.berries < price) throw new BlackMarketError(`Cuesta ฿ ${price.toLocaleString("es-ES")} y no los tienes.`);

  const prior = await dealsThisWindow(c.id, now);
  await prisma.character.update({ where: { id: c.id }, data: { berries: c.berries - price } });
  const log: string[] = [`Pagas ฿ ${price.toLocaleString("es-ES")} en un callejón sin nombre.`];

  if (stingSprung(prior)) {
    const dmg = stingDamage(c.hp, c.maxHp);
    await prisma.character.update({ where: { id: c.id }, data: { hp: c.hp - dmg } });
    log.push("¡Era una trampa! Agentes encubiertos de la Marina irrumpen: te quitan el género, te dan una paliza y te dejan tirado con el bolsillo vacío.");
    await prisma.gameLogEntry.create({ data: { characterId: c.id, kind: "blackmarket", text: log.join(" ") } });
    return { log, sting: true };
  }

  switch (offerId) {
    case "fruit": {
      if (fruitIsFake(marketWindow(now), seedOf(c.currentIsland.name))) log.push("Muerdes la fruta y sabe a barro: era una simple fruta podrida. Te han estafado.");
      else {
        const name = await tryDropFruit(c.id, []);
        log.push(name ? `Es auténtica: la ${name}. La guardas en la mochila; en el Inventario decides si te la comes.` : "No tienes dónde guardarla y el vendedor se la lleva de vuelta: has perdido el dinero.");
      }
      break;
    }
    case "blade": {
      await prisma.weapon.create({ data: { name: "Hoja de contrabando", kind: "Katana", grade: WeaponGrade.NONE, description: "Una espada robada de un arsenal de la Marina.", atkBonus: CONTRABAND_BLADE_ATK, basePrice: 60_000, ownerId: c.id } });
      log.push("Recibes una hoja de contrabando, envuelta en trapos. Equípala desde tu inventario.");
      break;
    }
    case "pardon": {
      if (c.faction === "PIRATE" || c.faction === "BOUNTY_HUNTER") {
        await prisma.character.update({ where: { id: c.id }, data: { bounty: c.bounty - pardonReduction(c.bounty) } });
      } else await prisma.character.update({ where: { id: c.id }, data: { notoriety: c.notoriety - pardonReduction(c.notoriety) } });
      log.push("El funcionario sonríe: tu expediente es ahora bastante más modesto.");
      break;
    }
    case "smoke": {
      await prisma.character.update({ where: { id: c.id }, data: { poneglyphHeat: Math.max(0, c.poneglyphHeat - 50) } });
      log.push("Los papeles falsos empiezan a circular: quien te perseguía pierde tu rastro por un tiempo.");
      break;
    }
    case "tonic": {
      await prisma.character.update({ where: { id: c.id }, data: { stamina: 100, staminaUpdatedAt: new Date() } });
      log.push("El brebaje quema al bajar, pero te sientes como nuevo.");
      break;
    }
  }
  await prisma.gameLogEntry.create({ data: { characterId: c.id, kind: "blackmarket", text: log.join(" ") } });
  return { log, sting: false };
}
