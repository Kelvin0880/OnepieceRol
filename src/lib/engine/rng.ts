/**
 * Deterministic pseudo-randomness for VARIETY only (which flavour text, which rumour, which shop stock): every
 * generator is seeded from stable inputs (ids, the clock window), so the same seed always gives the same pick.
 * Nothing that decides the result of a player's action may use this: those results are judged by the AI
 * (ai/judge.ts, ai/narrate.ts refereeExchange) or follow fixed rules. src/lib/no-dice.test.ts enforces it.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: a stable 32-bit hash of any string. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A generator seeded from text (an id, a time window...): same seed, same sequence. */
export function varietyRng(seed: string): Rng {
  return mulberry32(hashString(seed));
}

/** Integer in [min, max], inclusive on both ends. */
export function rollInt(rng: Rng, min: number, max: number): number {
  if (max < min) throw new Error(`rollInt: max (${max}) < min (${min})`);
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick one entry from a weighted list. Weights must be positive. */
export function weightedPick<T>(rng: Rng, entries: Array<{ item: T; weight: number }>): T {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) throw new Error("weightedPick: total weight must be > 0");
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return entries[entries.length - 1].item;
}
