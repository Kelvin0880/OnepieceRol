/**
 * Long crossings. Low-level characters hop between neighbouring islands as
 * before; from SAIL_ANYWHERE_LEVEL on, any faction may set a course for any
 * island they are allowed to enter, and the trip takes real time proportional
 * to the number of islands in between. Pure: no DB.
 */

export const SAIL_ANYWHERE_LEVEL = 20;
export const MINUTES_PER_HOP = 5;
export const MAX_VOYAGE_MS = 60 * 60_000;

export type IslandGraph = Record<string, string[]>;

/** Fewest hops between two islands (BFS), or null when there is no route. */
export function hopsBetween(graph: IslandGraph, from: string, to: string): number | null {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let hops = 1; frontier.length > 0; hops++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of graph[id] ?? []) {
        if (seen.has(n)) continue;
        if (n === to) return hops;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

export function canSailAnywhere(level: number): boolean {
  return level >= SAIL_ANYWHERE_LEVEL;
}

/** Real time a crossing of `hops` islands takes: 5 min per hop, never more than an hour. */
export function voyageDurationMs(hops: number): number {
  return Math.min(MAX_VOYAGE_MS, Math.max(1, hops) * MINUTES_PER_HOP * 60_000);
}

export interface VoyageStatus {
  atSea: boolean;
  arrived: boolean;
  msLeft: number;
}

export function voyageStatus(arrivesAt: Date | null, now: Date = new Date()): VoyageStatus {
  if (!arrivesAt) return { atSea: false, arrived: false, msLeft: 0 };
  const msLeft = arrivesAt.getTime() - now.getTime();
  return msLeft > 0 ? { atSea: true, arrived: false, msLeft } : { atSea: false, arrived: true, msLeft: 0 };
}

export function describeVoyageWait(msLeft: number): string {
  const min = Math.max(1, Math.ceil(msLeft / 60_000));
  return min === 1 ? "1 min" : `${min} min`;
}

/** A player who holds a Yonko-class position: their crossings are world news. */
export function isYonkoClass(title: string | null | undefined, bounty: number): boolean {
  return /yonko|emperador/i.test(title ?? "") || bounty >= 1_000_000_000;
}

/** A crossing of one island is safe water; every extra hop adds risk, capped at 55%. */
export function seaAmbushChance(hops: number): number {
  if (hops <= 1) return 0;
  return Math.min(0.55, 0.12 + 0.07 * (hops - 1));
}

export interface SeaAmbush {
  name: string;
  blurb: string;
}

const AMBUSHES: Record<string, SeaAmbush[]> = {
  PIRATE: [
    { name: "Patrulla de la Marina", blurb: "Una patrulla de la Marina te cierra el paso en mitad del mar." },
    { name: "Piratas rivales", blurb: "Un navío pirata sin bandera se cruza en tu rumbo y abre fuego." },
    { name: "Rey del Mar", blurb: "Algo enorme sube desde las profundidades y vuelca la calma del mar." },
  ],
  MARINE: [
    { name: "Corsarios sanguinarios", blurb: "Corsarios que han visto tu uniforme viran hacia tu barco." },
    { name: "Piratas rivales", blurb: "Un navío pirata te embosca aprovechando la niebla." },
    { name: "Rey del Mar", blurb: "Una bestia marina emerge junto al casco y embiste." },
  ],
  REVOLUTIONARY: [
    { name: "Patrulla de la Marina", blurb: "Una patrulla de la Marina te da el alto en mitad del mar." },
    { name: "Agentes de CP", blurb: "Un barco sin insignias te sigue desde hace horas y por fin acorta distancia." },
    { name: "Rey del Mar", blurb: "Una bestia marina sale a por tu barco." },
  ],
  BOUNTY_HUNTER: [
    { name: "Piratas con recompensa", blurb: "Unos piratas con cartel te reconocen y deciden que no eres una presa fácil, sino un trofeo." },
    { name: "Rey del Mar", blurb: "Una bestia marina emerge con hambre." },
  ],
  CP0: [
    { name: "Piratas rivales", blurb: "Piratas que huelen a Gobierno te cierran el paso." },
    { name: "Revolucionarios emboscados", blurb: "Un barco revolucionario te esperaba en esta ruta." },
    { name: "Rey del Mar", blurb: "Una bestia marina embiste el casco." },
  ],
};

export function pickSeaAmbush(rng: () => number, faction: string): SeaAmbush {
  const list = AMBUSHES[faction] ?? AMBUSHES.PIRATE;
  return list[Math.floor(rng() * list.length)];
}

/** Multiplier on the ambusher's strength: the farther you sail, the worse what waits. 0.9 to 1.3. */
export function seaAmbushPower(hops: number): number {
  return Math.min(1.3, 0.9 + 0.04 * Math.max(0, hops));
}
