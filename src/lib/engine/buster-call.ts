import { Rng } from "./rng";
import { actorCombatStats } from "./guardian";

/**
 * The Buster Call: the Government's last resort. Warships close on an island in
 * three waves; defenders have a fixed window to break all three, and if they
 * don't the fleet opens fire on everything still standing there.
 */

export const BUSTER_WAVES = 3;
export const BUSTER_DURATION_MS = 40 * 60 * 1000;
export const BOMBARDMENT_HP_FRACTION = 0.7;
const FLEET_POWER = 80; // power level the wave forces are modelled on; scaled up per wave

/** Chance an Impel Down breakout from this cell (or rescue out of it) brings the fleet: none for shallow cells, certain in the deepest. */
export function busterCallChance(cellLevel: number): number {
  if (cellLevel <= 2) return 0;
  if (cellLevel === 3) return 0.3;
  if (cellLevel === 4) return 0.6;
  return 1;
}

export function rollBusterCall(rng: Rng, cellLevel: number): boolean {
  const p = busterCallChance(cellLevel);
  return p > 0 && rng() < p;
}

export const WAVE_NAMES = ["Vanguardia de acorazados", "Flota de bombardeo", "Almirantazgo de la Buster Call"];

/** Stats of one wave (later waves hit harder); headcount scaling is applied by the joint fight itself. */
export function waveEnemy(wave: number, islandDanger: number) {
  const w = Math.max(1, Math.min(BUSTER_WAVES, wave));
  const s = actorCombatStats(FLEET_POWER);
  const k = 0.55 + 0.25 * (w - 1);
  const dangerBoost = 1 + Math.max(0, islandDanger - 8) * 0.04;
  return { name: WAVE_NAMES[w - 1], hp: Math.round(s.hp * k * 1.2), atk: Math.round(s.atk * k * dangerBoost), def: Math.round(s.def * k * dangerBoost), spd: Math.round(s.spd * k) };
}

export function waveRewards(wave: number, islandDanger: number) {
  return { berries: 15_000 * islandDanger * wave, xp: 90 * wave, bounty: 4_000_000 * wave, islandDanger };
}

export function bombardmentDamage(maxHp: number): number {
  return Math.round(maxHp * BOMBARDMENT_HP_FRACTION);
}

export type BusterStatus = "ACTIVE" | "REPELLED" | "FALLEN";

/** The status a siege should have right now, given progress and the clock. */
export function busterStatusNow(wavesBroken: number, endsAtMs: number, nowMs: number): BusterStatus {
  if (wavesBroken >= BUSTER_WAVES) return "REPELLED";
  if (nowMs > endsAtMs) return "FALLEN";
  return "ACTIVE";
}
