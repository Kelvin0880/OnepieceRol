/**
 * The judge: what used to be a dice roll is decided by the AI with logic. This file is the pure half: the shapes,
 * the strict parsing of the model's JSON, and the deterministic stand-in used only by scripted checks (JUDGE_STUB=1).
 * No randomness anywhere in here.
 */

export type JudgeOutcome = "critical_success" | "success" | "fail" | "critical_fail";
export const JUDGE_OUTCOMES: JudgeOutcome[] = ["critical_success", "success", "fail", "critical_fail"];

const OUTCOME_WORDS: Record<string, JudgeOutcome> = {
  exito_total: "critical_success",
  exito_brillante: "critical_success",
  exito: "success",
  fallo: "fail",
  fallo_grave: "critical_fail",
  desastre: "critical_fail",
  critical_success: "critical_success",
  success: "success",
  fail: "fail",
  critical_fail: "critical_fail",
};

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_");

function firstJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface OutcomeVerdict {
  outcome: JudgeOutcome;
  reason: string;
}

export function parseOutcomeVerdict(raw: string): OutcomeVerdict | null {
  const o = firstJson(raw);
  const outcome = o ? OUTCOME_WORDS[norm(o.resultado ?? o.outcome)] : undefined;
  if (!o || !outcome) return null;
  return { outcome, reason: String(o.motivo ?? o.reason ?? "").slice(0, 400) };
}

export type Fate = "death" | "captured" | "survives";
const FATE_WORDS: Record<string, Fate> = { muerte: "death", muere: "death", death: "death", captura: "captured", capturado: "captured", captured: "captured", sobrevive: "survives", vive: "survives", survives: "survives" };

export interface FateVerdict {
  fate: Fate;
  reason: string;
  companionsLost: string[];
}

export function parseFateVerdict(raw: string): FateVerdict | null {
  const o = firstJson(raw);
  const fate = o ? FATE_WORDS[norm(o.destino ?? o.fate)] : undefined;
  if (!o || !fate) return null;
  const lost = Array.isArray(o.companeros_caidos) ? o.companeros_caidos.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  return { fate, reason: String(o.motivo ?? o.reason ?? "").slice(0, 400), companionsLost: lost };
}

export interface ChoiceVerdict<T extends string> {
  choice: T;
  reason: string;
}

/** Only an id from the offered list is accepted. */
export function parseChoiceVerdict<T extends string>(raw: string, ids: readonly T[]): ChoiceVerdict<T> | null {
  const o = firstJson(raw);
  const c = o ? norm(o.eleccion ?? o.choice) : "";
  const found = ids.find((id) => norm(id) === c);
  return o && found ? { choice: found, reason: String(o.motivo ?? o.reason ?? "").slice(0, 400) } : null;
}

export interface MatchVerdict {
  winner: "a" | "b";
  reason: string;
}

export function parseMatchVerdict(raw: string): MatchVerdict | null {
  const o = firstJson(raw);
  const w = o ? norm(o.ganador ?? o.winner) : "";
  if (!o || (w !== "a" && w !== "b")) return null;
  return { winner: w, reason: String(o.motivo ?? o.reason ?? "").slice(0, 400) };
}

/** Difficulty class (0-99) in words, so the model does not have to interpret a bare number. */
export function difficultyLabel(dc: number): string {
  if (dc < 25) return "fácil";
  if (dc < 50) return "media";
  if (dc < 72) return "difícil";
  if (dc < 88) return "muy difícil";
  return "extrema";
}

// ---------------------------------------------------------------------------------------------
// Deterministic stand-ins (scripted checks only, JUDGE_STUB=1). Never used by the running game.
// ---------------------------------------------------------------------------------------------

/** Power beats difficulty: a wide margin is total, a narrow one is plain. */
export function stubOutcome(power: number, difficulty: number): JudgeOutcome {
  const margin = power - difficulty;
  return margin >= 40 ? "critical_success" : margin >= 0 ? "success" : margin <= -40 ? "critical_fail" : "fail";
}

/** The fallen die when the place is deadly for their level; a Government killer captures instead. */
export function stubFate(input: { islandDanger: number; level: number; durability: number; killerFaction?: string }): Fate {
  const risk = input.islandDanger * 10 - input.level - input.durability;
  if (risk >= 40) return "death";
  if (input.killerFaction === "MARINE" || input.killerFaction === "CP0") return "captured";
  return "survives";
}

export function stubMatch(a: { level: number; atk: number; def: number }, b: { level: number; atk: number; def: number }): "a" | "b" {
  const pa = a.atk + a.def + a.level * 2;
  const pb = b.atk + b.def + b.level * 2;
  return pa >= pb ? "a" : "b";
}

// ---------------------------------------------------------------------------------------------
// Closing a stuck fight against an NPC: the judge reads the whole fight and says how it ended.
// ---------------------------------------------------------------------------------------------

export type FightEnd = "player_won" | "player_lost" | "ended";
const FIGHT_END_WORDS: Record<string, FightEnd> = {
  gana_grupo: "player_won", gana_aliados: "player_won", gana_equipo: "player_won",
  pierde_grupo: "player_lost", pierde_aliados: "player_lost", pierde_equipo: "player_lost",
  gana_jugador: "player_won", gana: "player_won", victoria: "player_won", player_won: "player_won",
  pierde_jugador: "player_lost", pierde: "player_lost", derrota: "player_lost", player_lost: "player_lost",
  terminada: "ended", sin_ganador: "ended", empate: "ended", ended: "ended",
};

export interface FightEndVerdict {
  outcome: FightEnd;
  reason: string;
}

export function parseFightEndVerdict(raw: string): FightEndVerdict | null {
  const o = firstJson(raw);
  const outcome = o ? FIGHT_END_WORDS[norm(o.resultado ?? o.outcome)] : undefined;
  if (!o || !outcome) return null;
  return { outcome, reason: String(o.motivo ?? o.reason ?? "").slice(0, 500) };
}

/** Scripted checks only: whoever has more of their life left won. */
export function stubFightEnd(playerHp: number, playerMaxHp: number, enemyHp: number, enemyMaxHp: number): FightEnd {
  const p = playerHp / Math.max(1, playerMaxHp);
  const e = enemyHp / Math.max(1, enemyMaxHp);
  return p > e ? "player_won" : p < e ? "player_lost" : "ended";
}

/**
 * Group version of clampFightEnd: the group wins only if the rival is at half life or less, and loses only if every ally
 * still in the fight is at half life or less. Nobody can hand the fight to their side by asking.
 */
export function clampJointEnd(outcome: FightEnd, allies: { hp: number; maxHp: number }[], enemyHp: number, enemyMaxHp: number): FightEnd {
  if (outcome === "player_won" && enemyHp > enemyMaxHp / 2) return "ended";
  if (outcome === "player_lost" && allies.some((a) => a.hp > a.maxHp / 2)) return "ended";
  return outcome;
}

/**
 * A win or a loss is only accepted when the loser is at half life or less (the same rule the referee follows for a
 * defeat); otherwise the closing judge cannot hand a fight to whoever asks, and it is closed with no winner.
 */
export function clampFightEnd(outcome: FightEnd, playerHp: number, playerMaxHp: number, enemyHp: number, enemyMaxHp: number): FightEnd {
  if (outcome === "player_won" && enemyHp > enemyMaxHp / 2) return "ended";
  if (outcome === "player_lost" && playerHp > playerMaxHp / 2) return "ended";
  return outcome;
}
