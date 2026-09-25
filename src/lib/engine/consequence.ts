/**
 * Kill-vs-spare aftermath: sparing or finishing a named enemy leaves a thread
 * that comes back later, up to MAX_STAGE times, each return being a fresh
 * choice. Pure rules here; game/consequences.ts stores and applies them.
 */

export type ConsequenceKind = "spared" | "killed";
export type ConsequenceOutcome = "boon" | "betrayal" | "avenger" | "tribute";

export const MAX_STAGE = 3;
export const SPARED_DELAY_MS = 20 * 60_000;
export const KILLED_DELAY_MS = 10 * 60_000;
export const consequenceDelayMs = (kind: ConsequenceKind) => (kind === "spared" ? SPARED_DELAY_MS : KILLED_DELAY_MS);

export function consequenceRipe(dueAtMs: number, nowMs: number): boolean {
  return nowMs >= dueAtMs;
}

/** The two ways each thread can come back; the AI judge picks one from who the enemy is (ai/judge.ts judgeChoice). */
export const OUTCOME_OPTIONS: Record<ConsequenceKind, [ConsequenceOutcome, ConsequenceOutcome]> = {
  spared: ["boon", "betrayal"],
  killed: ["avenger", "tribute"],
};

export function boonRewards(stage: number, islandDanger: number) {
  const s = Math.max(1, Math.min(MAX_STAGE, stage));
  return { berries: 400 * islandDanger * s, xp: 40 * s, standing: true };
}

export function tributeRewards(stage: number, islandDanger: number) {
  const s = Math.max(1, Math.min(MAX_STAGE, stage));
  return { berries: 300 * islandDanger * s, notoriety: 6 * s };
}

/** The returning enemy is built from the player's own stats so the thread stays dangerous at any level. */
export function returningEnemy(player: { maxHp: number; atk: number; def: number; spd: number }, outcome: "betrayal" | "avenger", stage: number) {
  const s = Math.max(1, Math.min(MAX_STAGE, stage));
  const hard = outcome === "avenger" ? 1.1 : 1.0;
  return {
    hp: Math.round(player.maxHp * (0.9 + 0.15 * s) * hard),
    atk: Math.round(player.atk * (1 + 0.04 * s) * hard),
    def: Math.round(player.def * 0.95),
    spd: player.spd,
  };
}

export const nextStage = (stage: number): number | null => (stage >= MAX_STAGE ? null : stage + 1);
