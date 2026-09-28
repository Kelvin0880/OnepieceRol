/** A made-up poster for the landing's toy: stable per name, never used by the game itself. */
export interface SampleBounty {
  name: string;
  amount: number;
  epithet: string;
}

const EPITHETS = [
  "Mano de Hierro",
  "Ojos de Tormenta",
  "Sin Ancla",
  "Rompemástiles",
  "Marea Roja",
  "Cuervo del Alba",
  "Diente de Sierra",
  "Sal y Plomo",
  "Última Ola",
  "Pólvora Negra",
  "Cicatriz de Luna",
  "Filo de Coral",
  "Brújula Rota",
  "Viento Maldito",
  "Garra de Kraken",
  "Sin Bandera",
  "Fuego Fatuo",
  "Ancla Negra",
  "Sombra del Mástil",
  "Ojo del Huracán",
  "Canto de Sirena",
  "Hueso de Ballena",
  "Marea Muerta",
  "Trueno del Este",
  "Niebla Viva",
  "Colmillo de Mar",
  "Tinta Negra",
  "Siete Tormentas",
];

export const MAX_NAME_LENGTH = 24;

/** FNV-1a, 32 bits. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

export function bountyFor(raw: string): SampleBounty {
  const name = cleanName(raw) || "Desconocido";
  const key = name.toLocaleLowerCase("es");
  const h = hashString(key);
  const r = (h % 10_000) / 10_000;
  const spread = (hashString(key + "#") % 1000) / 1000;
  const [lo, hi] = r < 0.35 ? [10, 99] : r < 0.7 ? [100, 499] : r < 0.9 ? [500, 1_490] : [1_500, 3_200];
  const millions = Math.round(lo + (hi - lo) * spread);
  return { name, amount: millions * 1_000_000, epithet: EPITHETS[hashString(key + "@") % EPITHETS.length] };
}

export function formatBerries(amount: number): string {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
