/**
 * Player events ("Eventos"): a trial announced on an island that characters within a level band can join.
 * There is NO time limit: it ends when every human entrant has finished (submitted or withdrawn), the AI judge
 * scores everyone and the code picks the winner. Beginner events are for low levels. Pure: no DB, no AI.
 */

export const EVENT_MAX_OPEN = 3;
export const EVENT_CREATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const EVENT_DEFAULT_MIN_LEVEL = 1;
export const EVENT_DEFAULT_MAX_LEVEL = 10;
export const SUBMISSION_MIN = 20;
export const SUBMISSION_MAX = 3000;
export const NPC_RIVALS = 3;
export const PARTICIPATION_XP_SHARE = 0.25;
export const PARTICIPATION_BERRIES_SHARE = 0.1;

export type EntryStatus = "REGISTERED" | "SUBMITTED" | "WITHDRAWN";

export interface EntryLike {
  characterId: string | null;
  isNpc: boolean;
  status: string;
  score: number | null;
  submittedAt: Date | null;
  level: number;
  name: string;
}

export function canJoin(p: { level: number; status: string; minLevel: number; maxLevel: number; onIslandId: string; eventIslandId: string; alreadyIn: boolean; busyReason: string | null }): string | null {
  if (p.status !== "ALIVE") return "Solo un personaje vivo y libre puede participar.";
  if (p.alreadyIn) return "Ya estás inscrito en este evento.";
  if (p.busyReason) return p.busyReason;
  if (p.onIslandId !== p.eventIslandId) return "Tienes que estar en la isla del evento para inscribirte.";
  if (p.level < p.minLevel) return `Este evento pide nivel ${p.minLevel} o más.`;
  if (p.level > p.maxLevel) return `Este evento es solo para niveles hasta ${p.maxLevel}.`;
  return null;
}

/** The trial text: trimmed and bounded. Null when it is too short or too long to be a real attempt. */
export function cleanSubmission(text: string): string | null {
  const t = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return t.length >= SUBMISSION_MIN && t.length <= SUBMISSION_MAX ? t : null;
}

/** An event is ready to be judged when at least one human submitted and nobody human is still working on it. */
export function readyToResolve(entries: Pick<EntryLike, "isNpc" | "status">[]): boolean {
  const humans = entries.filter((e) => !e.isNpc);
  if (humans.some((e) => e.status === "REGISTERED")) return false;
  return humans.some((e) => e.status === "SUBMITTED");
}

/** How many humans still owe an attempt (for the progress news). */
export function pendingHumans(entries: Pick<EntryLike, "isNpc" | "status">[]): number {
  return entries.filter((e) => !e.isNpc && e.status === "REGISTERED").length;
}

/** Scores are whole numbers 0-100. */
export function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
  return Math.max(0, Math.min(100, v));
}

/** Highest score wins; on a tie a human beats an NPC, then whoever handed in first. Code decides, never the AI. */
export function pickWinner<T extends EntryLike>(entries: T[]): T | null {
  const scored = entries.filter((e) => e.status === "SUBMITTED" && e.score !== null);
  if (scored.length === 0) return null;
  return [...scored].sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    if (a.isNpc !== b.isNpc) return a.isNpc ? 1 : -1;
    return (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0);
  })[0];
}

export interface Rewards {
  berries: number;
  xp: number;
}

/** Winner gets the whole prize; every other human who finished gets a small consolation. */
export function rewardFor(isWinner: boolean, prize: Rewards): Rewards {
  if (isWinner) return { berries: prize.berries, xp: prize.xp };
  return { berries: Math.floor(prize.berries * PARTICIPATION_BERRIES_SHARE), xp: Math.floor(prize.xp * PARTICIPATION_XP_SHARE) };
}

/** Prize sizes scale with the top of the level band so a beginner event never pays like an endgame one. */
export function defaultPrize(maxLevel: number): Rewards {
  const l = Math.max(1, maxLevel);
  return { berries: 500 + l * 300, xp: 40 + l * 25 };
}

export function canCreateMore(open: number, lastCreatedAt: Date | null, now: Date): boolean {
  if (open >= EVENT_MAX_OPEN) return false;
  return !lastCreatedAt || now.getTime() - lastCreatedAt.getTime() >= EVENT_CREATE_INTERVAL_MS;
}

export interface JudgedEntry {
  index: number;
  score: number;
  verdict: string;
}

/** Reads the judge's JSON. Every entry gets a clamped score; anything missing scores 0 so nobody is silently dropped. */
export function parseTrialScores(raw: string, count: number): JudgedEntry[] | null {
  let obj: unknown;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    obj = JSON.parse(a >= 0 && b > a ? cleaned.slice(a, b + 1) : cleaned);
  } catch {
    return null;
  }
  const list = (obj as { resultados?: unknown })?.resultados;
  if (!Array.isArray(list)) return null;
  const out: JudgedEntry[] = Array.from({ length: count }, (_, i) => ({ index: i, score: 0, verdict: "" }));
  let seen = 0;
  for (const r of list) {
    const o = r as { indice?: unknown; puntos?: unknown; motivo?: unknown };
    const i = typeof o.indice === "number" ? Math.round(o.indice) : -1;
    if (i < 0 || i >= count) continue;
    out[i] = { index: i, score: clampScore(o.puntos), verdict: typeof o.motivo === "string" ? o.motivo.trim().slice(0, 300) : "" };
    seen++;
  }
  return seen === 0 ? null : out;
}

/** Deterministic stand-in for scripted checks (JUDGE_STUB=1): level and effort count. NPCs score by their level. */
export function stubTrialScores(entries: { level: number; text: string | null; isNpc: boolean }[]): JudgedEntry[] {
  return entries.map((e, index) => ({ index, score: clampScore(30 + e.level * 3 + (e.isNpc ? 10 : Math.min(30, Math.floor((e.text?.length ?? 0) / 20)))), verdict: "Puntuación de prueba." }));
}

/** News lines that need no AI: the announcement's tail, joins, progress and the result. Spanish, player-facing. */
export function joinLine(name: string, total: number): string {
  return `${name} se ha inscrito. Hay ${total} participante${total === 1 ? "" : "s"} en total.`;
}

export function progressLine(name: string, pending: number): string {
  return pending > 0 ? `${name} ha completado la prueba. Quedan ${pending} participante${pending === 1 ? "" : "s"} por terminar.` : `${name} ha completado la prueba. Ya solo falta el veredicto.`;
}

export function rewardSummary(p: { fruitName: string | null; berries: number; xp: number }): string {
  const parts: string[] = [];
  if (p.fruitName) parts.push(`la fruta única «${p.fruitName}»`);
  if (p.berries > 0) parts.push(`฿ ${p.berries.toLocaleString("es-ES")}`);
  if (p.xp > 0) parts.push(`${p.xp} XP`);
  return parts.join(" + ");
}
