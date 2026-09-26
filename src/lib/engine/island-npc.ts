// Filler cast of the islands: pure rules (roster block for the AI, target matching, stats, replacement, name policing).
import { varietyRng } from "./rng";

export interface IslandNpcRow {
  id: string;
  name: string;
  islandId: string;
  slot: string;
  title: string;
  category: string;
  description: string;
  personality: string;
  level: number;
  abilitiesJson: string | null;
  weapon: string | null;
  status: string;
  diedNote: string | null;
  memoryJson: string | null;
  generation: number;
  recoversAt?: Date | null;
  stateNote?: string | null;
}

export const REPLACEMENT_DELAY_MS = 6 * 60 * 60_000;
export const MAX_NPC_MEMORY = 8;

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** What a resident is doing right now. Only a free, living one can be talked to or fought; everyone else is off-limits to the AI and to other players. */
export function npcState(n: IslandNpcRow, now: Date, engaged: Set<string>): { usable: boolean; label: string } {
  if (n.status === "DEAD") return { usable: false, label: "muerto" };
  if (n.status === "CAPTURED") return { usable: false, label: n.stateNote ? `capturado (${n.stateNote})` : "capturado por la ley" };
  if (n.recoversAt && n.recoversAt.getTime() > now.getTime()) return { usable: false, label: n.stateNote ?? "herido, recuperándose" };
  if (engaged.has(n.id)) return { usable: false, label: "ocupado peleando con otro aventurero" };
  return { usable: true, label: "disponible" };
}

export function parseList(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function appendMemory(json: string | null | undefined, note: string, max = MAX_NPC_MEMORY): string {
  const list = [...parseList(json), note.trim()].filter(Boolean);
  return JSON.stringify(list.slice(-max));
}

export const FIGHTER_CATEGORIES = ["guard", "thug", "marine", "pirate"];

/** Only some residents fight for a living; a baker, a merchant or a clerk is a bystander. */
export const isFighter = (category: string) => FIGHTER_CATEGORIES.includes(category);

/** Combat numbers of a filler character: a level-2 guard matches the old generic guard, growth is gentle, bystanders are frail. */
export function npcStats(level: number, category = "guard"): { hp: number; atk: number; def: number; spd: number } {
  const l = Math.max(1, level);
  const base = { hp: Math.round(65 + 10 * l), atk: Math.round(12 + 2 * l), def: Math.round(4 + 0.7 * l), spd: Math.round(10 + l) };
  if (isFighter(category)) return base;
  return { hp: Math.round(base.hp * 0.55), atk: Math.max(3, Math.round(base.atk * 0.3)), def: Math.max(2, Math.round(base.def * 0.5)), spd: Math.round(base.spd * 0.8) };
}

/** What beating a resident pays. Fighters give experience and carry money; bystanders give nothing but a purse, and hurting them is no glory. */
export function npcRewards(level: number, category: string): { berries: number; xp: number } {
  const l = Math.max(1, level);
  if (!isFighter(category)) return { berries: Math.round(5 + 3 * l), xp: 0 };
  const purse = category === "thug" || category === "pirate" ? 1.3 : 1;
  return { berries: Math.round((30 + 18 * l) * purse), xp: Math.round(6 + 3 * l) };
}

const LOOT_TABLE: Record<string, { id: string; minLevel: number; chance: number }[]> = {
  guard: [{ id: "vendaje", minLevel: 1, chance: 0.5 }, { id: "racion", minLevel: 1, chance: 0.4 }, { id: "botiquin", minLevel: 12, chance: 0.3 }],
  marine: [{ id: "vendaje", minLevel: 1, chance: 0.5 }, { id: "botiquin", minLevel: 8, chance: 0.35 }, { id: "logpose", minLevel: 6, chance: 0.15 }],
  thug: [{ id: "sake", minLevel: 1, chance: 0.5 }, { id: "vendaje", minLevel: 1, chance: 0.35 }, { id: "mapa", minLevel: 5, chance: 0.12 }],
  pirate: [{ id: "sake", minLevel: 1, chance: 0.45 }, { id: "mapa", minLevel: 3, chance: 0.2 }, { id: "reliquia", minLevel: 15, chance: 0.1 }, { id: "botiquin", minLevel: 10, chance: 0.25 }],
};

/** The item a defeated fighter had on them (or null). Same resident + same seed = same answer. */
export function npcLoot(seed: string, category: string, level: number): string | null {
  const table = (LOOT_TABLE[category] ?? []).filter((e) => level >= e.minLevel);
  const rng = varietyRng(`npc-loot:${seed}`);
  for (const e of table) if (rng() < e.chance) return e.id;
  return null;
}

const CATEGORY_WORDS: Record<string, string[]> = {
  guard: ["guardia", "guardian", "carcelero", "vigilante", "centinela", "soldado"],
  thug: ["matón", "maton", "bandido", "ladron", "ladrón", "pandillero", "rufian", "rufián", "matones"],
  marine: ["marine", "marinero", "soldado marine", "oficial", "sargento", "teniente"],
  merchant: ["mercader", "vendedor", "tendero", "comerciante"],
  civilian: ["tabernero", "camarero", "barman", "posadero", "pescador", "campesino", "aldeano", "cocinero"],
  pirate: ["pirata", "corsario"],
  official: ["alcalde", "juez", "gobernador", "funcionario"],
};

/** Finds the living roster member a player is talking about: an exact/partial name first, then a job word ("el guardia", "el tabernero"). */
export function matchNpc(roster: IslandNpcRow[], text: string, unavailable: Set<string> = new Set()): IslandNpcRow | null {
  const t = strip(text);
  if (!t.trim()) return null;
  const alive = roster.filter((n) => n.status === "ALIVE" && !unavailable.has(n.id));
  for (const n of alive) {
    const full = strip(n.name);
    if (t.includes(full) || full.includes(t.trim())) return n;
  }
  for (const n of alive) {
    if (strip(n.name).split(/\s+/).some((w) => w.length >= 4 && t.split(/[^a-z0-9ñ]+/).includes(w))) return n;
  }
  for (const n of alive) {
    if (strip(n.title).split(/[^a-z0-9ñ]+/).some((w) => w.length >= 5 && t.split(/[^a-z0-9ñ]+/).includes(w))) return n;
    if (strip(n.slot).split(/[^a-z0-9ñ]+/).some((w) => w.length >= 5 && t.split(/[^a-z0-9ñ]+/).includes(w))) return n;
  }
  for (const n of alive) {
    if ((CATEGORY_WORDS[n.category] ?? []).some((w) => new RegExp(`\\b${strip(w)}`).test(t))) return n;
  }
  return null;
}

/** Someone from the roster who can plausibly be the enemy of a random encounter on this island. */
export function pickCombatNpc(roster: IslandNpcRow[], seed: string, wanted: string[] = ["thug", "guard", "pirate", "marine"], unavailable: Set<string> = new Set()): IslandNpcRow | null {
  const pool = roster.filter((n) => n.status === "ALIVE" && !unavailable.has(n.id) && wanted.includes(n.category));
  if (pool.length === 0) return null;
  return pool[Math.floor(varietyRng(`npc-pick:${seed}`)() * pool.length)];
}

export const ROSTER_RULE =
  "PERSONAJES NOMBRADOS (regla absoluta): en esta isla SOLO existen como personajes con nombre los de la lista de HABITANTES, los personajes canon del ESTADO DEL MUNDO / QUIÉN ESTÁ AQUÍ y los jugadores reales. " +
  "PROHIBIDO inventar cualquier otro personaje con nombre propio (ni tabernero, ni guardia, ni rival, ni testigo). Para lo que la historia necesite usa a alguien de la lista según su oficio; " +
  "si hace falta gente de fondo, que sea anónima y sin protagonismo (\"un pescador\", \"la multitud\", \"otro guardia\") y nunca un rival con nombre ni alguien que hable como personaje. " +
  "Si el jugador quiere hablar o pelear con alguien que no está en la lista, es alguien anónimo del fondo o un habitante de la lista con ese oficio. Respeta la personalidad y la memoria de cada habitante.";

export function rosterBlock(islandName: string, roster: IslandNpcRow[], now = new Date(), engaged: Set<string> = new Set(), maxUsable = 14): string {
  const states = roster.map((n) => ({ n, st: npcState(n, now, engaged) }));
  const usable = states.filter((x) => x.st.usable).slice(0, maxUsable);
  const busy = states.filter((x) => !x.st.usable && x.n.status !== "DEAD");
  const dead = states.filter((x) => x.n.status === "DEAD").slice(-4);
  if (usable.length === 0 && busy.length === 0 && dead.length === 0) return "";
  const lines = usable.map(({ n }) => {
    const mem = parseList(n.memoryJson).slice(-3);
    return `- ${n.name} — ${n.title} (nivel ${n.level}, ${n.category}): ${n.personality}${mem.length ? ` MEMORIA: ${mem.join("; ")}` : ""}`;
  });
  const away = busy.length ? `
NO DISPONIBLES AHORA (no aparecen en escena, nadie puede hablar ni pelear con ellos): ${busy.map(({ n, st }) => `${n.name} (${st.label})`).join("; ")}.` : "";
  const gone = dead.length ? `
MUERTOS (ya no aparecen, solo se los recuerda): ${dead.map(({ n }) => `${n.name}${n.diedNote ? ` (${n.diedNote})` : ""}`).join("; ")}.` : "";
  return `HABITANTES DE ${islandName} (los únicos personajes de relleno con nombre propio permitidos aquí, con su estado en tiempo real):
${lines.join("\n")}${away}${gone}
${ROSTER_RULE}`;
}

export function npcSummaryForFight(n: IslandNpcRow): string {
  const abilities = parseList(n.abilitiesJson);
  const fighting = isFighter(n.category) ? (abilities.length ? ` Sabe hacer: ${abilities.join(", ")}.` : " Sin técnicas especiales: pelea como lo que es.") : " NO es un combatiente: se defiende con torpeza, suplica, huye o pide ayuda a gritos.";
  return `${n.title}. ${n.personality}${n.weapon ? ` Arma: ${n.weapon}.` : ""}${fighting}`;
}

/** Dead residents whose job still needs someone, once the mourning delay has passed. */
export function dueForReplacement<T extends { status: string; successorId: string | null; diedAt: Date | null }>(rows: T[], now: Date, delayMs = REPLACEMENT_DELAY_MS): T[] {
  return rows.filter((r) => r.status === "DEAD" && !r.successorId && r.diedAt && now.getTime() - r.diedAt.getTime() >= delayMs);
}

const FIRST = ["Bruno", "Marga", "Tobías", "Ilsa", "Garrick", "Nerea", "Dorian", "Selka", "Fenn", "Yara", "Olaf", "Mirta", "Kasper", "Lidia", "Hobb", "Tamsin", "Rurik", "Perla", "Doma", "Vesper", "Cato", "Nilo", "Sabina", "Orrin", "Zelda", "Bram", "Isolde", "Ferro", "Lucía", "Tarek", "Odalys", "Wren", "Gaspar", "Kenji", "Maru", "Ayla", "Ronan", "Suri", "Anselmo", "Kaia"];
const LAST = ["Mareas", "Ancla Rota", "el Cojo", "Sal", "Cuervo", "Barrica", "Faro", "Herrumbre", "Ostras", "Tormenta", "Pez Vela", "Nudo", "Cabo", "Brea", "Arenal", "Gaviota", "Anzuelo", "Carena", "Trueno", "Coral", "Espuma", "Boya", "Cañón", "Ron Viejo"];

/** Offline stand-in when the AI cannot write the successor: a fresh name that is not taken. */
export function fallbackSuccessor(dead: IslandNpcRow, takenNames: Set<string>): { name: string; personality: string; description: string } {
  const rng = varietyRng(`npc-successor:${dead.id}:${dead.generation}`);
  let name = "";
  for (let i = 0; i < 60 && (!name || takenNames.has(name)); i++) name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
  if (takenNames.has(name)) name = `${name} ${dead.generation + 1}`;
  return {
    name,
    personality: dead.personality,
    description: `${dead.title}. Llegó a la isla para ocupar el puesto que dejó ${dead.name} y todavía se está ganando el respeto del lugar.`,
  };
}

export interface GeneratedNpc {
  name: string;
  title: string;
  description: string;
  personality: string;
  weapon: string | null;
  abilities: string[];
}

/** Validates what the AI wrote for a successor: a fresh, sane name and the same job. Returns null if unusable. */
export function parseGeneratedNpc(raw: string, takenNames: Set<string>): GeneratedNpc | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const v = JSON.parse(m[0]) as Record<string, unknown>;
    const name = typeof v.name === "string" ? v.name.trim() : "";
    if (name.length < 3 || name.length > 40 || takenNames.has(name) || /[\n{}"]/.test(name)) return null;
    const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
    const description = str(v.description, 400);
    const personality = str(v.personality, 240);
    if (description.length < 20 || personality.length < 10) return null;
    return {
      name,
      title: str(v.title, 80),
      description,
      personality,
      weapon: str(v.weapon, 60) || null,
      abilities: Array.isArray(v.abilities) ? v.abilities.filter((a): a is string => typeof a === "string").map((a) => a.slice(0, 80)).slice(0, 4) : [],
    };
  } catch {
    return null;
  }
}

const PERSON = "(?:hombre|hombres|mujer|tipo|tío|chico|chica|muchacho|muchacha|anciano|anciana|viejo|vieja|joven|sujeto|individuo|figura|guardia|guardián|soldado|marine|pirata|matón|bandido|tabernero|tabernera|camarero|camarera|mercader|comerciante|capitán|teniente|sargento|niño|niña|pescador|cocinero|cocinera|líder|jefe|jefa|vendedor|vendedora)";
const INTRO_RE = new RegExp(String.raw`\b${PERSON}\b[^.!?\n]{0,40}?\b(?:llamad[oa]s?|apodad[oa]s?|conocid[oa]s? como|de nombre)\s+(?:["“«'])?([A-ZÁÉÍÓÚÑ][\wáéíóúñü'’-]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñü'’-]{2,})?)`, "gi");

const NAME = String.raw`([A-ZÁÉÍÓÚÑ][\wáéíóúñü'’-]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñü'’-]{2,})?)`;
// "Es Makino, la tabernera" / "Soy Rocco." / "me llamo Bruno"
const IS_RE = new RegExp(String.raw`(?:^|[.!?—"“»]\s*|\n\s*)(?:Es|Era|Soy|Eres)\s+${NAME}\s*[,.—!]`, "g");
const SELF_RE = new RegExp(String.raw`\b(?:[Mm]e llamo|[Mm]i nombre es|[Ss]e llama|[Ss]e llamaba)\s+${NAME}`, "g");
// "Harlan Reed, el nuevo guardia" / "Makino, la tabernera"
const APPOSITION_RE = new RegExp(String.raw`${NAME},\s+(?:el|la|un|una)(?:\s+(?:nuev[oa]|antigu[oa]|joven|viej[oa]|veterano|veterana))?\s+${PERSON}\b`, "g");

function cleanName(raw: string): string {
  return raw.trim().split(/\s+/).filter((w, i, arr) => arr.slice(0, i + 1).every((x) => x[0] !== x[0].toLowerCase())).join(" ");
}

/** Names the text presents as characters ("un hombre llamado Vorgen", "Es Makino, la tabernera") that are not in the allowed set. */
export function inventedNames(text: string, allowed: string[]): string[] {
  const ok = allowed.map(strip);
  const out: string[] = [];
  const found: string[] = [];
  for (const m of text.matchAll(INTRO_RE)) found.push(m[1]);
  for (const re of [IS_RE, SELF_RE, APPOSITION_RE]) for (const m of text.matchAll(re)) found.push(m[1]);
  for (const raw of found) {
    const n = cleanName(raw);
    if (!n) continue;
    const s = strip(n);
    if (ok.some((a) => a === s || a.includes(s) || s.includes(a) || a.split(/\s+/).includes(s.split(/\s+/)[0]))) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
