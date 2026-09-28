// Snapshot of the real game catalogs for the landing page. Run from the repo root:
//   npx tsx landing/scripts/extract-game-data.ts
// Re-run whenever islands, fruits, residents or the canon cast change.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEVIL_FRUIT_CATALOG } from "../../src/lib/game/devil-fruit-catalog";
import { ISLAND_NPC_DATA } from "../../src/lib/game/island-npc-data";
import { ISLAND_NPC_DATA_WAVE2 } from "../../src/lib/game/island-npc-data-wave2";
import { SPECIAL_RECRUITS } from "../../src/lib/game/special-recruit-data";
import { EXTRA_ACTORS } from "../../src/lib/game/world-actor-extra";
import { MORE_ACTORS } from "../../src/lib/game/world-actor-more";
import { WAVE4_ACTORS } from "../../src/lib/game/world-actor-wave4";
import { WAVE5_ACTORS } from "../../src/lib/game/world-actor-wave5";
import { IMPEL_ACTORS } from "../../src/lib/game/world-actor-impel";
import { rankProgress, type FactionKey } from "../../src/lib/engine/progression";
import { HISTORY_CHAPTERS } from "../../src/lib/engine/poneglyph-lore";

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + from.length);
  if (a < 0 || b < 0) throw new Error(`marker not found: ${from} .. ${to}`);
  return src.slice(a + from.length, b);
}

// ---------- islands: docs/mapa.html is the maintained public reference ----------
const mapa = read("docs", "mapa.html");
type MapIsland = { key: string; name: string; sea: string; danger: number; minLevel: number; faction: string | null; poneglyph: boolean; poneglyphName?: string; desc: string; hook: string };
const mapIslands = new Function(`return [${between(mapa, "const ISLANDS = [", "\n];")}\n];`)() as MapIsland[];
const seaOf = (s: string) => (s.startsWith("East Blue") ? "East Blue" : s.startsWith("Paradise") ? "Paradise" : "Nuevo Mundo");

const seed = read("prisma", "seed.ts");
const wave4 = read("src", "lib", "game", "islands-wave4.ts");
const seedIslandKeys = new Set([
  ...[...between(seed, "const islandDefs = [", "for (const def of [...islandDefs").matchAll(/key: "([A-Za-z0-9]+)"/g)].map((m) => m[1]),
  ...[...wave4.matchAll(/key: "([A-Za-z0-9]+)"/g)].map((m) => m[1]),
]);
const missingOnMap = [...seedIslandKeys].filter((k) => !mapIslands.some((i) => i.key === k));
if (missingOnMap.length) console.warn(`islands in the seed but not on docs/mapa.html: ${missingOnMap.join(", ")}`);

// ---------- factions ----------
const cc = read("src", "lib", "game", "create-character.ts");
const startBlock = between(cc, "STARTING_ISLAND_BY_FACTION: Record<Faction, string> = {", "};");
const starts = Object.fromEntries([...startBlock.matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
const archetypes = [...between(cc, "export const ARCHETYPES = [", "] as const;").matchAll(/name: "([^"]+)",\s*description: "([^"]+)"/g)].map((m) => ({ name: m[1], description: m[2] }));

function ladder(faction: FactionKey): string[] {
  const titles: string[] = [];
  let value = 0;
  for (let guard = 0; guard < 30; guard++) {
    const p = rankProgress(faction, faction === "PIRATE" ? value : 0, faction === "PIRATE" ? 0 : value);
    titles.push(p.title);
    if (p.target === null) break;
    value = p.target;
  }
  return titles;
}

const FACTIONS: FactionKey[] = ["PIRATE", "MARINE", "REVOLUTIONARY", "BOUNTY_HUNTER", "CP0"];
const factions = FACTIONS.map((key) => ({ key, start: starts[key], metric: rankProgress(key, 0, 0).metric, ladder: ladder(key) }));

// ---------- canon cast ----------
const seedActorSection = between(seed, "const actors: ActorSeed[] = [", "const worldActors:");
const seedActors = [...seedActorSection.matchAll(/^ {6}name: "([^"]+)",\s*\n\s*role: ActorRole\.(\w+)/gm)].map((m) => ({ name: m[1], role: m[2], status: "ACTIVE" }));
const fileActors = [...EXTRA_ACTORS, ...MORE_ACTORS, ...WAVE4_ACTORS, ...WAVE5_ACTORS, ...IMPEL_ACTORS].map((a) => ({ name: a.name, role: String(a.role), status: a.status ?? "ACTIVE" }));
const canon = [...seedActors, ...fileActors];
const canonNames = new Set(canon.map((a) => a.name));
const byRole = (role: string) => canon.filter((a) => a.role === role && a.status === "ACTIVE").map((a) => a.name);

// ---------- residents ----------
const residents = [...ISLAND_NPC_DATA, ...ISLAND_NPC_DATA_WAVE2, ...SPECIAL_RECRUITS];
const residentNames = new Set(residents.map((r) => r.name));

// ---------- fruits ----------
const fruitType = (t: string) => (t.startsWith("ZOAN") ? "ZOAN" : t);
const fruits = DEVIL_FRUIT_CATALOG.map((f) => ({ name: f.name, type: fruitType(String(f.type)), sub: String(f.type), rarity: String(f.rarity), description: f.description }));
const fruitsByType = fruits.reduce<Record<string, number>>((acc, f) => ((acc[f.type] = (acc[f.type] ?? 0) + 1), acc), {});

const data = {
  counts: {
    islands: mapIslands.length,
    fruits: fruits.length,
    fruitsByType,
    canon: canonNames.size,
    residents: residentNames.size,
    factions: factions.length,
    roadPoneglyphs: mapIslands.filter((i) => i.poneglyph).length,
    historyPoneglyphs: HISTORY_CHAPTERS.length,
  },
  islands: mapIslands.map((i) => ({
    key: i.key,
    name: i.name,
    sea: seaOf(i.sea),
    danger: i.danger,
    minLevel: i.minLevel,
    faction: i.faction,
    poneglyph: i.poneglyph ? (i.poneglyphName ?? "").replace(/^Poneglifo de Ruta — /, "") : null,
    desc: i.desc,
  })),
  factions,
  archetypes,
  canon: {
    yonko: byRole("YONKO"),
    admirals: byRole("ADMIRAL"),
    gorosei: byRole("GOROSEI"),
    revolution: byRole("REVOLUTIONARY_COMMANDER"),
    warlords: byRole("WARLORD"),
    cipherPol: byRole("CIPHER_POL"),
  },
  history: HISTORY_CHAPTERS.map((c) => ({ title: c.title, island: c.islandName })),
  fruits,
};

const out = join(root, "landing", "src", "data", "game-data.json");
writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
console.log(`wrote ${out}`);
console.log(JSON.stringify({ counts: data.counts, seedIslands: seedIslandKeys.size, factions: factions.map((f) => `${f.key}@${f.start}: ${f.ladder.length} ranks`) }, null, 2));
