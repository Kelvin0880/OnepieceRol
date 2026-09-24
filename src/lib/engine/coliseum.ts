import { resolveExchange, type Combatant } from "./combat";
import type { Rng } from "./rng";

export type CompetitionKind = "weapons" | "fruit" | "gold";

export const COLISEUM_ISLAND_NAME = "Dressrosa";
/** Rare on purpose: a special event, not a daily grind. */
export const TOURNAMENT_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Announced this long before it starts, so people can sail to Dressrosa. */
export const REGISTRATION_LEAD_MS = 3 * 60 * 60 * 1000;
/** Time between rounds: long enough to describe a strategy, short enough to finish in an evening. */
export const ROUND_INTERVAL_MS = 15 * 60 * 1000;
export const MAX_BOUT_ROUNDS = 40;

export interface PrizeSpec {
  kind: "weapon" | "fruit" | "berries";
  label: string;
  weapon?: { name: string; kind: string; atkBonus: number; description: string };
  fruitName?: string;
  berries?: number;
}

export type TournamentStatus = "ANNOUNCED" | "RUNNING" | "FINISHED" | "CANCELLED";

export const KIND_LABELS: Record<CompetitionKind, string> = {
  weapons: "Torneo de armas",
  fruit: "Torneo de la Fruta del Diablo",
  gold: "Gran torneo del oro",
};

const WEAPON_PRIZES = [
  { name: "Espada del Coliseo", kind: "Espada", base: 8, description: "Hoja de gladiador, equilibrada y sin adornos." },
  { name: "Lanza de Campeón", kind: "Lanza", base: 10, description: "Larga, ligera y hecha para castigar a distancia." },
  { name: "Cimitarra Dorada", kind: "Sable", base: 12, description: "Una cimitarra bañada en oro: pesa poco y corta mucho." },
  { name: "Tridente del Gran Coliseo", kind: "Tridente", base: 14, description: "El tridente que se entrega al campeón del año." },
];

/** What the winner takes home, decided when the tournament is announced (and printed in the news). */
export function choosePrize(rng: Rng, kind: CompetitionKind, avgLevel: number, fruitNames: string[]): PrizeSpec {
  const level = Math.max(1, avgLevel);
  if (kind === "weapons") {
    const w = WEAPON_PRIZES[Math.floor(rng() * WEAPON_PRIZES.length)];
    const atkBonus = w.base + Math.floor(level / 6);
    return { kind: "weapon", label: `${w.name} (+${atkBonus} ATQ)`, weapon: { name: w.name, kind: w.kind, atkBonus, description: w.description } };
  }
  if (kind === "fruit" && fruitNames.length > 0) {
    const name = fruitNames[Math.floor(rng() * fruitNames.length)];
    return { kind: "fruit", label: `la ${name}`, fruitName: name };
  }
  const berries = 200_000 + level * 40_000;
  return { kind: "berries", label: `฿ ${berries.toLocaleString("es-ES")}`, berries };
}

export function pickKind(rng: Rng): CompetitionKind {
  const r = rng();
  return r < 0.4 ? "weapons" : r < 0.7 ? "fruit" : "gold";
}

export function bracketSize(entrants: number): 4 | 8 | 16 {
  if (entrants <= 4) return 4;
  if (entrants <= 8) return 8;
  return 16;
}

export function totalRounds(size: number): number {
  return Math.round(Math.log2(size));
}

export function roundName(size: number, round: number): string {
  const left = size / 2 ** (round - 1);
  if (left <= 2) return "Final";
  if (left === 4) return "Semifinales";
  if (left === 8) return "Cuartos de final";
  return "Octavos de final";
}

/** Fisher-Yates over the ids, then adjacent pairs: a fully random draw, every id exactly once. */
export function drawBracket(rng: Rng, ids: string[]): [string, string][] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]);
  return pairs;
}

const GLADIATOR_NAMES = ["Brutus", "Kalisto", "Gorm", "Máximo", "Tigris", "Ajax", "Ruggiero", "Marcelo", "Fulgor", "Ébano", "Sirio", "Leónidas", "Corvo", "Titán", "Ira", "Nerón"];
export function gladiatorNames(rng: Rng, count: number, taken: Set<string>): string[] {
  const pool = GLADIATOR_NAMES.filter((n) => !taken.has(n));
  const out: string[] = [];
  while (out.length < count) {
    if (pool.length === 0) {
      out.push(`Gladiador ${out.length + 1}`);
      continue;
    }
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

/** A gladiator at a given experience: comparable to a player of that level who spent their points evenly. */
export function gladiatorCombatant(name: string, level: number, named: boolean): Combatant {
  const L = Math.max(1, level + (named ? 3 : 0));
  const hp = 100 + L * 4;
  return { name, hp, maxHp: hp, atk: Math.round(12 + L * 1.6), def: Math.round(8 + L * 1.1), spd: Math.round(10 + L), level: L };
}

export interface BoutResult {
  winner: "a" | "b";
  rounds: number;
  aHpPct: number;
  bHpPct: number;
}

/**
 * A non-lethal bout on copies of each fighter's full health: nobody carries wounds out of the arena, so this
 * never touches a real character's HP. The tactic bonus is the same bounded nudge combat uses (attack in full, defence in half).
 */
export function runBout(rng: Rng, a: Combatant, b: Combatant, tacticA = 0, tacticB = 0): BoutResult {
  const fa: Combatant = { ...a, atk: a.atk + tacticA, def: a.def + Math.round(tacticA / 2) };
  const fb: Combatant = { ...b, atk: b.atk + tacticB, def: b.def + Math.round(tacticB / 2) };
  let aHp = a.maxHp;
  let bHp = b.maxHp;
  let round = 0;
  while (round < MAX_BOUT_ROUNDS && aHp > 0 && bHp > 0) {
    round++;
    const r = resolveExchange(rng, round, fa, aHp, fb, bHp);
    aHp = r.aHpAfter;
    bHp = r.bHpAfter;
  }
  const aPct = Math.max(0, aHp) / a.maxHp;
  const bPct = Math.max(0, bHp) / b.maxHp;
  const winner: "a" | "b" = bHp <= 0 && aHp > 0 ? "a" : aHp <= 0 && bHp > 0 ? "b" : aPct > bPct ? "a" : bPct > aPct ? "b" : a.spd >= b.spd ? "a" : "b";
  return { winner, rounds: round, aHpPct: Math.round(aPct * 100), bHpPct: Math.round(bPct * 100) };
}

export interface ScheduleState {
  status: TournamentStatus | null;
  startsAtMs?: number;
  roundEndsAtMs?: number;
  lastTournamentAtMs: number | null;
}

export type ScheduleAction = "announce" | "start" | "resolve_round" | "none";

/** What the lazy tick should do right now. Pure so the whole calendar is testable. */
export function nextAction(s: ScheduleState, nowMs: number): ScheduleAction {
  if (s.status === "ANNOUNCED") return s.startsAtMs !== undefined && nowMs >= s.startsAtMs ? "start" : "none";
  if (s.status === "RUNNING") return s.roundEndsAtMs !== undefined && nowMs >= s.roundEndsAtMs ? "resolve_round" : "none";
  if (s.lastTournamentAtMs === null || nowMs - s.lastTournamentAtMs >= TOURNAMENT_INTERVAL_MS) return "announce";
  return "none";
}

export function canRegister(input: { onDressrosa: boolean; alive: boolean; busy: boolean; status: TournamentStatus | null; alreadyRegistered: boolean }): { ok: true } | { ok: false; reason: string } {
  if (input.status !== "ANNOUNCED") return { ok: false, reason: "Ahora mismo no hay ninguna inscripción abierta en el coliseo." };
  if (!input.alive) return { ok: false, reason: "Tu personaje no puede competir en su estado actual." };
  if (!input.onDressrosa) return { ok: false, reason: "Solo pueden inscribirse quienes estén en Dressrosa: llega a la isla y vuelve." };
  if (input.busy) return { ok: false, reason: "Estás en un duelo o una pelea: termínala antes de inscribirte." };
  if (input.alreadyRegistered) return { ok: false, reason: "Ya estás inscrito en este torneo." };
  return { ok: true };
}
