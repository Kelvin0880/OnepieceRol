/**
 * Deterministic, seedable RNG (mulberry32). Every engine function takes an
 * Rng instance instead of calling Math.random() directly, so combat/loot/
 * death rolls stay reproducible in tests while remaining truly random in
 * production (seeded from crypto-strength entropy per request).
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

export function liveRng(): Rng {
  return Math.random;
}

/** Integer in [min, max], inclusive on both ends. */
export function rollInt(rng: Rng, min: number, max: number): number {
  if (max < min) throw new Error(`rollInt: max (${max}) < min (${min})`);
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** A d100 roll — the backbone of every skill check in the engine. */
export function rollD100(rng: Rng): number {
  return rollInt(rng, 1, 100);
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
