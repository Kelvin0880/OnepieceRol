/**
 * Island secrets: hand-written discoveries an exploring player can stumble on, with fixed rewards. No dice anywhere:
 * whether a secret is "open" for a character in a given hour is a stable hash of (character, secret, hour), so it is
 * deterministic for the same state and the AI never decides whether a discovery happens or what it pays.
 */

export interface SecretReward {
  berries?: number;
  xp?: number;
  items?: { id: string; qty: number }[];
  weapon?: { name: string; kind: string; atkBonus: number; description: string; basePrice?: number };
  /** Only a non-singleton catalog fruit name, and only on the rarest secrets. */
  fruit?: string;
}

export interface IslandSecret {
  /** Stable, never reused: "<island-slug>:<secret-slug>". It is the key of the "already found" record. */
  id: string;
  /** Exact island name. */
  island: string;
  /** Optional exact name of a place from that island's lore gazetteer. */
  place?: string;
  title: string;
  /** Fixed Spanish text shown to the player; names only real places and residents, invents nobody. */
  discovery: string;
  /** Share of hours in which this secret is findable by a given character (0-1). */
  chance: number;
  minLevel: number;
  maxLevel?: number;
  /** null = found once per character, ever. */
  cooldownHours: number | null;
  reward: SecretReward;
}

export const HOUR_MS = 3_600_000;

/** FNV-1a: a stable 32-bit hash, so "random-looking" but fully reproducible. */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function secretWindowOpen(characterId: string, secretId: string, now: Date, chance: number): boolean {
  const hour = Math.floor(now.getTime() / HOUR_MS);
  return (stableHash(`${characterId}|${secretId}|${hour}`) % 10_000) / 10_000 < chance;
}

/** Secrets of this island the character can still find right now (level band, one-time or cooldown). */
export function eligibleSecrets(secrets: IslandSecret[], islandName: string, level: number, found: Map<string, Date>, now: Date): IslandSecret[] {
  return secrets
    .filter((s) => s.island === islandName && level >= s.minLevel && (s.maxLevel === undefined || level <= s.maxLevel))
    .filter((s) => {
      const last = found.get(s.id);
      if (!last) return true;
      return s.cooldownHours !== null && now.getTime() - last.getTime() >= s.cooldownHours * HOUR_MS;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The first eligible secret whose window is open for this character this hour, or null. */
export function pickSecret(eligible: IslandSecret[], characterId: string, now: Date): IslandSecret | null {
  return eligible.find((s) => secretWindowOpen(characterId, s.id, now, s.chance)) ?? null;
}

export interface SecretsCatalog {
  islandNames: Set<string>;
  placesByIsland: Map<string, Set<string>>;
  itemIds: Set<string>;
  /** Non-singleton fruit names only. */
  fruitNames: Set<string>;
}

/** Everything that would make a secret pay out garbage or name something that does not exist. Empty = valid. */
export function validateSecrets(secrets: IslandSecret[], cat: SecretsCatalog): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const s of secrets) {
    const at = `[${s.id}]`;
    if (seen.has(s.id)) errors.push(`${at} duplicate id`);
    seen.add(s.id);
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(s.id)) errors.push(`${at} id must look like island-slug:secret-slug`);
    if (!cat.islandNames.has(s.island)) errors.push(`${at} unknown island "${s.island}"`);
    if (s.place && !cat.placesByIsland.get(s.island)?.has(s.place)) errors.push(`${at} place "${s.place}" is not in the lore of ${s.island}`);
    if (s.title.length < 3 || s.discovery.length < 60) errors.push(`${at} title/discovery too short`);
    if (!(s.chance > 0 && s.chance <= 0.5)) errors.push(`${at} chance must be in (0, 0.5]`);
    if (s.minLevel < 1 || (s.maxLevel !== undefined && s.maxLevel < s.minLevel)) errors.push(`${at} bad level band`);
    if (s.cooldownHours !== null && s.cooldownHours < 6) errors.push(`${at} cooldown under 6 hours`);
    const r = s.reward;
    const worth = (r.berries ?? 0) + (r.xp ?? 0) + (r.items?.length ?? 0) + (r.weapon ? 1 : 0) + (r.fruit ? 1 : 0);
    if (worth === 0) errors.push(`${at} pays nothing`);
    if ((r.berries ?? 0) < 0 || (r.xp ?? 0) < 0) errors.push(`${at} negative reward`);
    for (const it of r.items ?? []) if (!cat.itemIds.has(it.id) || it.qty < 1 || it.qty > 5) errors.push(`${at} bad item ${it.id} x${it.qty}`);
    if (r.fruit && !cat.fruitNames.has(r.fruit)) errors.push(`${at} fruit "${r.fruit}" is not a non-singleton catalog fruit`);
    if (r.fruit && s.cooldownHours !== null) errors.push(`${at} a fruit secret must be one-time`);
  }
  return errors;
}
