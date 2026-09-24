/**
 * Every canon character always has a place in the world. Each world tick a few of them
 * move to a neighbouring island (pirates roam, marines stay near their bases, the
 * revolutionaries and Cipher Pol slip about in secret), and the narrator is told who
 * is where — so the AI can build lore around real presences instead of inventing them.
 * Pure: no DB.
 */
import type { Rng } from "./rng";

export interface MovableActor {
  id: string;
  name: string;
  factionType: string;
  role: string;
  status: string;
  currentIslandId: string | null;
  homeIslandId: string | null;
  /** "sea" = sailing between two islands right now (currentIslandId is null). */
  locationKind?: string;
  /** Deployed by a world beat or caught in an arc: it must not wander off. */
  pinned: boolean;
}

export interface Move {
  actorId: string;
  toIslandId: string;
  hidden: boolean;
  /** Sets sail: the actor is "en el mar" until the next tick, then arrives at toIslandId. */
  viaSea?: boolean;
}

export const UNKNOWN_LOCATION = "Ubicación desconocida";
const VIA_SEA_CHANCE: Record<string, number> = { PIRATE: 0.55, BOUNTY_HUNTER: 0.4, MARINE: 0.3, UNAFFILIATED: 0.3, REVOLUTIONARY: 0.2, CIPHER_POL: 0.15, CIVILIAN: 0.1 };

const MOVE_CHANCE: Record<string, number> = { PIRATE: 0.3, MARINE: 0.18, REVOLUTIONARY: 0.25, CIPHER_POL: 0.3, BOUNTY_HUNTER: 0.3, CIVILIAN: 0.04, UNAFFILIATED: 0.15 };
const HIDE_CHANCE: Record<string, number> = { REVOLUTIONARY: 0.6, CIPHER_POL: 0.8, BOUNTY_HUNTER: 0.15, PIRATE: 0.1, MARINE: 0.05, UNAFFILIATED: 0.2, CIVILIAN: 0 };
/** Yonko and the Government's top brass hold their ground; they do not wander at random. */
const ANCHORED_ROLES = new Set(["YONKO", "GOROSEI", "HIDDEN_RULER"]);

export const MAX_MOVES_PER_TICK = 3;

/** Picks who relocates this tick. Anyone without a location is placed at home first, so nobody is ever "nowhere". */
export function pickMoves(rng: Rng, actors: MovableActor[], neighborsOf: (islandId: string) => string[], maxMoves = MAX_MOVES_PER_TICK): Move[] {
  const moves: Move[] = [];
  const placed = new Set<string>();

  for (const a of actors) {
    if (a.status !== "ACTIVE" || a.currentIslandId || a.locationKind === "sea" || !a.homeIslandId) continue;
    moves.push({ actorId: a.id, toIslandId: a.homeIslandId, hidden: false });
    placed.add(a.id);
  }

  const candidates = actors.filter((a) => a.status === "ACTIVE" && !a.pinned && a.currentIslandId && a.locationKind !== "sea" && !placed.has(a.id));
  for (const a of candidates) {
    if (moves.length - placed.size >= maxMoves) break;
    if (ANCHORED_ROLES.has(a.role) && rng() > 0.15) continue;
    if (rng() >= (MOVE_CHANCE[a.factionType] ?? 0.15)) continue;
    const options = neighborsOf(a.currentIslandId!);
    if (options.length === 0) continue;
    const goHome = a.homeIslandId && a.homeIslandId !== a.currentIslandId && options.includes(a.homeIslandId) && rng() < 0.4;
    const to = goHome ? a.homeIslandId! : options[Math.floor(rng() * options.length)];
    const hidden = rng() < (HIDE_CHANCE[a.factionType] ?? 0);
    moves.push({ actorId: a.id, toIslandId: to, hidden, viaSea: rng() < (VIA_SEA_CHANCE[a.factionType] ?? 0.2) });
  }
  return moves;
}

export function locationLabel(islandName: string | null | undefined, hidden: boolean): string {
  if (hidden || !islandName) return UNKNOWN_LOCATION;
  return islandName;
}

/** Between two islands, on the water: never pretends to be on either of them. */
export function seaLabel(fromName: string | null | undefined, toName: string | null | undefined): string {
  if (fromName && toName) return `En el mar, entre ${fromName} y ${toName}`;
  return "En alta mar";
}

export interface WhereInput {
  hidden: boolean;
  kind?: string | null;
  islandName?: string | null;
  seaFromName?: string | null;
  seaToName?: string | null;
}

/** The single source of truth for "where is this character" wording: an island, at sea, or unknown. */
export function whereLabel(w: WhereInput): { name: string; kind: "island" | "sea" | "unknown" } {
  if (w.hidden) return { name: UNKNOWN_LOCATION, kind: "unknown" };
  if (w.kind === "sea") return { name: seaLabel(w.seaFromName, w.seaToName), kind: "sea" };
  if (!w.islandName) return { name: UNKNOWN_LOCATION, kind: "unknown" };
  return { name: w.islandName, kind: "island" };
}

export interface PresenceActor {
  name: string;
  role: string;
  factionName: string;
  rankLabel?: string | null;
  hidden: boolean;
}

export interface PresenceInput {
  islandName: string;
  here: PresenceActor[];
  nearby: { name: string; islandName: string; hidden: boolean }[];
  /** One-line summaries of running world events touching this area. */
  worldEvents?: string[];
}

/**
 * The "living map" the narrator reads before every scene: real canon presences on this island and next door,
 * with the etiquette for using them. Secret ones are known to the narrator but not to the player.
 */
export function describePresence(p: PresenceInput): string {
  const open = p.here.filter((a) => !a.hidden);
  const secret = p.here.filter((a) => a.hidden);
  const fmt = (a: PresenceActor) => `${a.name} (${a.rankLabel ?? a.role.toLowerCase().replace(/_/g, " ")}, ${a.factionName})`;
  const lines: string[] = [`MUNDO VIVO — presencias reales en ${p.islandName}: ${open.length ? open.map(fmt).join("; ") : "ningún personaje canon a la vista"}.`];
  if (secret.length) lines.push(`Presentes en secreto (tú lo sabes, los personajes NO: no los reveles salvo que la trama lo pida con lógica): ${secret.map(fmt).join("; ")}.`);
  const near = p.nearby.filter((n) => !n.hidden).slice(0, 6);
  if (near.length) lines.push(`En islas vecinas: ${near.map((n) => `${n.name} en ${n.islandName}`).join("; ")}.`);
  if (p.worldEvents && p.worldEvents.length) lines.push(`Eventos mundiales en curso: ${p.worldEvents.join(" | ")}.`);
  lines.push(
    "Usa este mapa para tejer lore con lógica (rumores, avistamientos, patrullas, encargos, consecuencias), como si el mundo siguiera vivo sin el jugador. " +
      "Un canon solo aparece si está aquí; habla y actúa con su personalidad y rango (un almirante no charla por gusto con un novato); a lo sumo uno o dos por escena. " +
      "Nunca decidas por el jugador ni resuelvas combates; JAMÁS mates ni captures a un personaje canon en una escena."
  );
  return lines.join(" ");
}
