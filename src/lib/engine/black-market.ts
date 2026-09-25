import { Rng, mulberry32 } from "./rng";

/**
 * Contraband dealers on a few lawless islands. Stock rotates every window,
 * everything is priced above the legal shop, and any deal may be a marine
 * sting — so buying here is a real risk, not a shortcut.
 */

export const BLACK_MARKET_ISLANDS = ["Loguetown", "Whisky Peak", "Water 7", "Archipiélago Sabaody"];
export const MARKET_WINDOW_MS = 3 * 3600_000;
export const OFFERS_PER_WINDOW = 3;
export const FAKE_FRUIT_CHANCE = 0.3;
export const BASE_STING_CHANCE = 0.1;
export const STING_PER_PRIOR_DEAL = 0.05;
export const STING_HP_FRACTION = 0.15;

export type OfferId = "fruit" | "blade" | "pardon" | "smoke" | "tonic";

export interface OfferSpec {
  id: OfferId;
  name: string;
  description: string;
}

export const OFFER_CATALOG: OfferSpec[] = [
  { id: "fruit", name: "Fruta sin nombre", description: "Una fruta extraña de origen dudoso. Puede ser un Akuma no Mi... o una simple fruta podrida." },
  { id: "blade", name: "Hoja de contrabando", description: "Una espada robada de un arsenal de la Marina, con un filo muy por encima del común (+12 ATQ)." },
  { id: "pardon", name: "Indulto comprado", description: "Un funcionario corrupto borra un tercio de tu fama en los archivos (reduce tu recompensa o notoriedad un 30%)." },
  { id: "smoke", name: "Cortina de humo", description: "Documentos falsos y rumores plantados: enfrían la persecución por Poneglifos (-50 de calor)." },
  { id: "tonic", name: "Tónico prohibido", description: "Un brebaje de origen dudoso que te deja como nuevo al instante (estamina al máximo)." },
];

export const marketWindow = (nowMs: number) => Math.floor(nowMs / MARKET_WINDOW_MS);
export const msToNextWindow = (nowMs: number) => (marketWindow(nowMs) + 1) * MARKET_WINDOW_MS - nowMs;

/** Same stock for everyone on the same island and window, so it is stable between reloads. */
export function offersForWindow(windowIndex: number, islandSeed: number): OfferSpec[] {
  const rng = mulberry32(windowIndex * 7919 + islandSeed);
  const pool = [...OFFER_CATALOG];
  const picked: OfferSpec[] = [];
  while (picked.length < OFFERS_PER_WINDOW && pool.length) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return picked;
}

export function offerPrice(id: OfferId, ctx: { bounty: number; notoriety: number; faction: string }): number {
  switch (id) {
    case "fruit":
      return 300_000;
    case "blade":
      return 60_000;
    case "pardon": {
      const fame = ctx.faction === "PIRATE" || ctx.faction === "BOUNTY_HUNTER" ? ctx.bounty : ctx.notoriety * 1000;
      return Math.max(20_000, Math.round(fame * 0.02));
    }
    case "smoke":
      return 40_000;
    case "tonic":
      return 15_000;
  }
}

export function stingChance(priorDealsThisWindow: number): number {
  return Math.min(0.5, BASE_STING_CHANCE + STING_PER_PRIOR_DEAL * Math.max(0, priorDealsThisWindow));
}

/** The sting comes for whoever has dealt too much in one window: the third deal is the trap. */
export const stingSprung = (prior: number) => prior >= 2;
/** Which windows sell a rotten fruit is fixed by the market's own stock, so the same buyer sees the same offer. */
export const fruitIsFake = (windowIndex: number, islandSeed: number) => (windowIndex * 31 + islandSeed) % 5 === 0;

/** A sting hurts but never kills: it leaves at least 1 HP. */
export const stingDamage = (hp: number, maxHp: number) => Math.min(Math.max(0, hp - 1), Math.round(maxHp * STING_HP_FRACTION));

export const isBlackMarketIsland = (name: string) => BLACK_MARKET_ISLANDS.includes(name);

export const pardonReduction = (current: number) => Math.round(current * 0.3);
