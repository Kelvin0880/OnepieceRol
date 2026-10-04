// The only way to give a devil fruit back (owner's request, 2026-10-04): Isla Kairos, a rock built on the largest
// natural Kairoseki vein in the world, where the Order of the Silent Sea drains a user's power in its Still Waters.
// Expensive on purpose — the price grows with the level and with how much power is being torn out — and final:
// the fruit's power returns to the sea, and the next fruit eaten starts from zero mastery.

export const FRUIT_REMOVAL_ISLAND = "Isla Kairos";

export interface FruitRemovalInput {
  level: number;
  fruitType: string;
  awakened: boolean;
  /** A 1-of-1 fruit (event prizes, owner-made fruits): rarer power, harder to pull out. */
  singleton: boolean;
}

const TYPE_MULT: Record<string, number> = { PARAMECIA: 1, ZOAN: 1, ZOAN_ANCIENT: 1.25, ZOAN_MYTHICAL: 1.5, LOGIA: 1.5 };

export function fruitRemovalPrice(i: FruitRemovalInput): number {
  const level = Math.max(1, Math.floor(Number.isFinite(i.level) ? i.level : 1));
  const base = 150_000 + 15_000 * level;
  const raw = base * (TYPE_MULT[i.fruitType] ?? 1) * (i.singleton ? 1.5 : 1) * (i.awakened ? 2 : 1);
  return Math.round(raw / 5_000) * 5_000;
}

export interface FruitRemovalContext {
  hasFruit: boolean;
  islandName: string;
  alive: boolean;
  berries: number;
  price: number;
}

/** Why the Order would turn you away right now, or null when the ritual can go ahead. */
export function fruitRemovalBlockReason(c: FruitRemovalContext): string | null {
  if (!c.alive) return "En tu estado actual nadie puede llevarte a las Aguas Quietas.";
  if (!c.hasFruit) return "No llevas dentro el poder de ninguna Fruta del Diablo: no hay nada que arrancar.";
  if (c.islandName !== FRUIT_REMOVAL_ISLAND) return `Solo la Orden del Mar Callado, en ${FRUIT_REMOVAL_ISLAND}, sabe arrancar una fruta.`;
  if (c.berries < c.price) return `La Orden cobra ฿ ${c.price.toLocaleString("es-ES")} por el ritual y no te alcanza.`;
  return null;
}
