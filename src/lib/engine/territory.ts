import { actorCombatStats } from "./guardian";

/**
 * Territory conquest rules. A held island falls in three stages — the army,
 * the commanders, then the holder in person — each a joint fight. Whoever
 * contributed then votes who keeps it, and the winner has to keep a garrison
 * up or the old power takes it back.
 */

export type ConquestStage = "ARMY" | "COMMANDERS" | "HOLDER";
export const STAGES: ConquestStage[] = ["ARMY", "COMMANDERS", "HOLDER"];

export const GARRISON_MAX = 100;
export const GARRISON_DECAY_PER_PERIOD = 25;
export const GARRISON_PERIOD_MS = 12 * 3600_000;
export const CONQUEST_IDLE_EXPIRY_MS = 48 * 3600_000;
export const VOTE_WINDOW_MS = 24 * 3600_000;
export const INCOME_CAP_HOURS = 24;
export const FORTIFY_COST_PER_POINT = 250;
export const DEFENSE_GARRISON_LOSS = 40;

export function nextStage(stage: ConquestStage): ConquestStage | null {
  const i = STAGES.indexOf(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

export const STAGE_LABELS: Record<ConquestStage, string> = {
  ARMY: "el ejército",
  COMMANDERS: "los comandantes",
  HOLDER: "el líder",
};

/** Points a participant earns for surviving a cleared stage on their feet (downed allies earn half). */
export function contributionPoints(stage: ConquestStage, downed: boolean): number {
  const base = stage === "ARMY" ? 2 : stage === "COMMANDERS" ? 4 : 6;
  return downed ? base / 2 : base;
}

const STAGE_POWER_SHARE: Record<ConquestStage, number> = { ARMY: 0.6, COMMANDERS: 0.85, HOLDER: 1 };

/** Stats of the force met at a stage, from the holder's power level. Scaled for headcount later by the joint fight itself. */
export function stageEnemy(stage: ConquestStage, holderPower: number, islandDanger: number) {
  const s = actorCombatStats(holderPower);
  const k = STAGE_POWER_SHARE[stage];
  const dangerBoost = 1 + Math.max(0, islandDanger - 8) * 0.05;
  return {
    hp: Math.round(s.hp * k * (stage === "ARMY" ? 1.2 : 1)),
    atk: Math.round(s.atk * k * dangerBoost),
    def: Math.round(s.def * k * dangerBoost),
    spd: Math.round(s.spd * k),
  };
}

/** What a stage's victory pays each participant (holder stage pays the most). */
export function stageRewards(stage: ConquestStage, islandDanger: number) {
  const m = stage === "ARMY" ? 1 : stage === "COMMANDERS" ? 2 : 4;
  return { berries: 10_000 * islandDanger * m, xp: 80 * m, bounty: 3_000_000 * m, islandDanger };
}

export function garrisonAfterElapsed(garrison: number, elapsedMs: number): number {
  const periods = Math.floor(Math.max(0, elapsedMs) / GARRISON_PERIOD_MS);
  return Math.max(0, garrison - periods * GARRISON_DECAY_PER_PERIOD);
}

/** Milliseconds of `elapsedMs` already accounted for by whole decay periods (so the pressure clock advances without losing the remainder). */
export function consumedPeriodMs(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / GARRISON_PERIOD_MS) * GARRISON_PERIOD_MS;
}

export function fortifyCost(garrison: number): number {
  return Math.max(0, GARRISON_MAX - garrison) * FORTIFY_COST_PER_POINT;
}

export function incomeAccrued(islandDanger: number, elapsedMs: number): number {
  const hours = Math.min(INCOME_CAP_HOURS, Math.max(0, elapsedMs) / 3600_000);
  return Math.floor(hours * islandDanger * 1500);
}

export function conquestExpired(lastActivityMs: number, nowMs: number): boolean {
  return nowMs - lastActivityMs > CONQUEST_IDLE_EXPIRY_MS;
}

export interface VoteOutcome {
  winnerId: string | null;
  tally: Record<string, number>;
}

/**
 * Votes are weighted by what each voter contributed. Ties go to whoever
 * struck the final blow, then to the larger contribution, then to the
 * lexicographically smaller id so the outcome is always deterministic.
 * Votes for people who didn't contribute, and votes from non-contributors,
 * are ignored. With no valid votes the top contributor wins.
 */
export function resolveVote(votes: Record<string, string>, contributions: Record<string, number>, finalBlowId: string | null): VoteOutcome {
  const tally: Record<string, number> = {};
  for (const [voter, candidate] of Object.entries(votes)) {
    const weight = contributions[voter] ?? 0;
    if (weight <= 0 || (contributions[candidate] ?? 0) <= 0) continue;
    tally[candidate] = (tally[candidate] ?? 0) + weight;
  }
  const pool = Object.keys(Object.keys(tally).length ? tally : Object.fromEntries(Object.entries(contributions).filter(([, v]) => v > 0)));
  if (pool.length === 0) return { winnerId: null, tally };
  const score = (id: string) => (Object.keys(tally).length ? tally[id] : contributions[id]);
  pool.sort((a, b) => {
    if (score(b) !== score(a)) return score(b) - score(a);
    if (finalBlowId && (a === finalBlowId) !== (b === finalBlowId)) return a === finalBlowId ? -1 : 1;
    if ((contributions[b] ?? 0) !== (contributions[a] ?? 0)) return (contributions[b] ?? 0) - (contributions[a] ?? 0);
    return a < b ? -1 : 1;
  });
  return { winnerId: pool[0], tally };
}

export function allContributorsVoted(votes: Record<string, string>, contributions: Record<string, number>): boolean {
  const contributors = Object.entries(contributions).filter(([, v]) => v > 0).map(([k]) => k);
  return contributors.length > 0 && contributors.every((c) => votes[c]);
}

export function titleForHolder(actorRole: string | null, islandName: string): string {
  if (actorRole === "YONKO") return `Yonko de ${islandName}`;
  if (actorRole === "ADMIRAL" || actorRole === "MARINE_GENERAL") return `Señor de la justicia de ${islandName}`;
  return `Señor de ${islandName}`;
}
