import { prisma } from "../db";
import { WeaponGrade, CharacterStatus } from "@prisma/client";
import {
  isBlackMarketIsland,
  marketWindow,
  msToNextWindow,
  offersForWindow,
  offerPrice,
  rollSting,
  rollFakeFruit,
  stingDamage,
  pardonReduction,
  OfferId,
  MARKET_WINDOW_MS,
} from "../engine/black-market";
import { liveRng } from "../engine/rng";
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
  if (offerId === "fruit" && c.devilFruitId) throw new BlackMarketError("Ya cargas con el poder de una fruta: otra te mataría.");
  // A character holds a single weapon row (Weapon.ownerId is unique): the contraband blade upgrades a weaker one in place and is refused, before paying, when yours is already as good.
  const ownedWeapon = offerId === "blade" ? await prisma.weapon.findFirst({ where: { ownerId: c.id } }) : null;
  if (ownedWeapon && ownedWeapon.atkBonus >= CONTRABAND_BLADE_ATK) throw new BlackMarketError("Ya llevas un arma igual o mejor que esa hoja: no te sirve de nada.");

  const rng = liveRng();
  const prior = await dealsThisWindow(c.id, now);
  await prisma.character.update({ where: { id: c.id }, data: { berries: c.berries - price } });
  const log: string[] = [`Pagas ฿ ${price.toLocaleString("es-ES")} en un callejón sin nombre.`];

  if (rollSting(rng, prior)) {
    const dmg = stingDamage(c.hp, c.maxHp);
    await prisma.character.update({ where: { id: c.id }, data: { hp: c.hp - dmg } });
    log.push("¡Era una trampa! Agentes encubiertos de la Marina irrumpen: te quitan el género, te dan una paliza y te dejan tirado con el bolsillo vacío.");
    await prisma.gameLogEntry.create({ data: { characterId: c.id, kind: "blackmarket", text: log.join(" ") } });
    return { log, sting: true };
  }

  switch (offerId) {
    case "fruit": {
      if (rollFakeFruit(rng)) log.push("Muerdes la fruta y sabe a barro: era una simple fruta podrida. Te han estafado.");
      else {
        const name = await tryDropFruit(c.id, []);
        log.push(name ? `Al morderla, lo sientes: has obtenido la ${name}. El mar te rechaza para siempre.` : "La fruta se deshace en tu mano.");
      }
      break;
    }
    case "blade": {
      const blade = { name: "Hoja de contrabando", kind: "Katana", grade: WeaponGrade.NONE, description: "Una espada robada de un arsenal de la Marina.", atkBonus: CONTRABAND_BLADE_ATK, basePrice: 60_000 };
      if (ownedWeapon) await prisma.weapon.update({ where: { id: ownedWeapon.id }, data: blade });
      else await prisma.weapon.create({ data: { ...blade, ownerId: c.id } });
      log.push(ownedWeapon ? `Cambias tu ${ownedWeapon.name} por una hoja de contrabando, envuelta en trapos.` : "Recibes una hoja de contrabando, envuelta en trapos.");
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
