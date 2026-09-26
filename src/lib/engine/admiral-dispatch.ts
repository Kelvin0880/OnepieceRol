/**
 * Admiral dispatch: rarely, the Government sends one of its admirals to wipe out the pirate players of an island.
 * The crossing takes real time (players may leave), on arrival the fight is automatic and inescapable for whoever
 * stayed, the defeated are captured, and an admiral who finds nobody sails home in the same time. Pure rules only.
 */
import type { Rng } from "./rng";

export const DISPATCH_MIN_LEVEL = 2;
export const DISPATCH_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const DISPATCH_START_CHANCE_PER_TICK = 0.02;
export const DISPATCH_MIN_TRAVEL_MS = 20 * 60_000;
export const DISPATCH_MAX_TRAVEL_MS = 60 * 60_000;
const MS_PER_HOP = 8 * 60_000;

/** Where every character starts: the Government never opens its campaign there. */
export const STARTER_ISLAND_NAMES = ["Pueblo Foosha", "Cuartel Marine G-5", "Isla Baltigo", "Isla Gecko", "Tequila Wolf"];
const NEVER_TARGET = ["Impel Down", "Laugh Tale", "Mary Geoise"];

export interface TargetableIsland {
  name: string;
  factionControl: string | null;
  /** Faction of the canon holder of the island's territory, if any. */
  ownerFaction: string | null;
  /** A player holds the territory (a player Yonko's domain). */
  ownedByPlayer: boolean;
}

/** Starter islands, Revolutionary islands and pirate-held islands (canon crews, canon Yonko or player territories) are off limits. */
export function islandProtectedFromDispatch(i: TargetableIsland): boolean {
  if (STARTER_ISLAND_NAMES.includes(i.name) || NEVER_TARGET.includes(i.name)) return true;
  const control = (i.factionControl ?? "").toLowerCase();
  if (/revolucion/.test(control) || /pirata|yonko|baroque/.test(control)) return true;
  if (i.ownerFaction === "PIRATE" || i.ownerFaction === "REVOLUTIONARY" || i.ownedByPlayer) return true;
  return false;
}

export function dispatchTravelMs(hops: number): number {
  return Math.max(DISPATCH_MIN_TRAVEL_MS, Math.min(DISPATCH_MAX_TRAVEL_MS, Math.round(hops * MS_PER_HOP)));
}

/** Only pirate players, level 2+, alive and free are hunted. */
export function isDispatchTarget(c: { faction: string; level: number; status: string }): boolean {
  return c.faction === "PIRATE" && c.level >= DISPATCH_MIN_LEVEL && c.status === "ALIVE";
}

export interface DispatchStartContext {
  hasOpen: boolean;
  lastEndedAt: Date | null;
  now: Date;
}

/** Rare by design: one at a time, a long quiet spell after each, and a small chance per world tick. */
export function shouldStartDispatch(rng: Rng, ctx: DispatchStartContext): boolean {
  if (ctx.hasOpen) return false;
  if (ctx.lastEndedAt && ctx.now.getTime() - ctx.lastEndedAt.getTime() < DISPATCH_COOLDOWN_MS) return false;
  return rng() < DISPATCH_START_CHANCE_PER_TICK;
}

/** Draws an island weighted by how many hunted players stand on it; none = no dispatch. */
export function pickDispatchTarget(rng: Rng, islands: { id: string; targets: number }[]): string | null {
  const pool = islands.filter((i) => i.targets > 0);
  const total = pool.reduce((n, i) => n + i.targets, 0);
  if (total === 0) return null;
  let roll = rng() * total;
  for (const i of pool) {
    roll -= i.targets;
    if (roll < 0) return i.id;
  }
  return pool[pool.length - 1].id;
}

export type DispatchPhaseNow = "wait" | "arrive" | "home";

/** What the clock says should happen to a dispatch now. */
export function dispatchPhase(d: { status: string; arrivesAt: Date; returnsAt: Date | null }, now: Date): DispatchPhaseNow {
  if (d.status === "EN_ROUTE" && now.getTime() >= d.arrivesAt.getTime()) return "arrive";
  if (d.status === "RETURNING" && d.returnsAt && now.getTime() >= d.returnsAt.getTime()) return "home";
  return "wait";
}

/** An admiral's first move: announced like any rival attack, so the players' round answers it. */
export function admiralOpening(name: string, islandName: string, signature: string | null): string {
  const move = signature ? `abre el ataque con ${signature}` : "abre el ataque con toda su fuerza";
  return `${name}, almirante de la Marina, desembarca en ${islandName} para erradicar a los piratas. Sin una palabra de aviso ${move}, dirigido contra quien tenga más cerca; si llega a conectar, nadie en la isla saldrá indemne. Cada uno describe cómo responde; después ${name} contestará a TODAS las acciones a la vez y se defenderá de ellas.`;
}
