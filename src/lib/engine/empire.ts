import { GARRISON_DECAY_PER_PERIOD, GARRISON_MAX, GARRISON_PERIOD_MS } from "./territory";

/**
 * The player's domain seen as an army, plus errands: a nakama or commander can be sent away for a while
 * and comes back with a result the engine rolled. Pure rules; game/empire.ts stores and pays them.
 */

export type ErrandKind = "patrol" | "tribute" | "scout";

export interface Errand {
  kind: ErrandKind;
  startedAt: number;
  endsAt: number;
  /** Territory patrolled (patrol only). */
  islandId?: string;
}

export const ERRAND_KINDS: ErrandKind[] = ["patrol", "tribute", "scout"];

export const ERRAND_INFO: Record<ErrandKind, { label: string; brief: string; durationMs: number }> = {
  patrol: { label: "Patrullar un dominio", brief: "Refuerza la guarnición de una isla que sostienes.", durationMs: 45 * 60_000 },
  tribute: { label: "Cobrar tributos", brief: "Recorre los puertos aliados y vuelve con berries.", durationMs: 90 * 60_000 },
  scout: { label: "Explorar el mar", brief: "Busca rumores y rutas; vuelve con experiencia.", durationMs: 60 * 60_000 },
};

export const PATROL_GARRISON_GAIN = 20;
export const FAILED_ERRAND_HP_LOSS = 0.3;

/** Rough headcount of the garrison, for flavour: a full garrison on a dangerous island is a real army. */
export function troopCount(garrison: number, islandDanger: number): number {
  return Math.round((Math.max(0, garrison) / GARRISON_MAX) * (150 + 100 * islandDanger));
}

export function garrisonLabel(garrison: number): string {
  if (garrison >= 90) return "Intacta";
  if (garrison >= 60) return "Firme";
  if (garrison >= 30) return "Debilitada";
  return "Al borde de caer";
}

/** Time until the neglected garrison reaches zero and the island reverts, given when the current decay period started. */
export function msUntilFall(garrison: number, lastPressureMs: number, nowMs: number): number {
  if (garrison <= 0) return 0;
  const periods = Math.ceil(garrison / GARRISON_DECAY_PER_PERIOD);
  const intoPeriod = Math.max(0, nowMs - lastPressureMs) % GARRISON_PERIOD_MS;
  return periods * GARRISON_PERIOD_MS - intoPeriod;
}

/** How hard the errand is (0-99) for the AI judge, from the danger of the place against the nakama's power. */
export function errandDifficulty(power: number, islandDanger: number): number {
  const needed = 20 + 12 * islandDanger;
  return Math.max(10, Math.min(95, Math.round(50 + (needed - power) * 0.5)));
}

export interface ErrandOutcome {
  success: boolean;
  garrisonGain: number;
  berries: number;
  xp: number;
  hpLossFraction: number;
}

/** The rewards of an errand whose result the judge already decided. */
export function errandRewards(kind: ErrandKind, success: boolean, islandDanger: number): ErrandOutcome {
  if (!success) return { success: false, garrisonGain: 0, berries: 0, xp: 0, hpLossFraction: FAILED_ERRAND_HP_LOSS };
  return {
    success: true,
    garrisonGain: kind === "patrol" ? PATROL_GARRISON_GAIN : 0,
    berries: kind === "tribute" ? 6_000 * islandDanger : 0,
    xp: kind === "scout" ? 60 + 20 * islandDanger : 0,
    hpLossFraction: 0,
  };
}

/** Companion profile JSON is shared with the commanders' hand-written sheets, so the errand is merged in, never replacing it. */
export function readErrand(profileJson: string | null | undefined): Errand | null {
  if (!profileJson) return null;
  try {
    const raw = (JSON.parse(profileJson) as Record<string, unknown>)?.errand as Record<string, unknown> | undefined;
    if (!raw || !ERRAND_KINDS.includes(raw.kind as ErrandKind)) return null;
    if (typeof raw.startedAt !== "number" || typeof raw.endsAt !== "number") return null;
    return { kind: raw.kind as ErrandKind, startedAt: raw.startedAt, endsAt: raw.endsAt, islandId: typeof raw.islandId === "string" ? raw.islandId : undefined };
  } catch {
    return null;
  }
}

export function writeErrand(profileJson: string | null | undefined, errand: Errand | null): string | null {
  let base: Record<string, unknown> = {};
  try {
    const parsed = profileJson ? JSON.parse(profileJson) : {};
    if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>;
  } catch {
    base = {};
  }
  if (errand) base.errand = errand;
  else delete base.errand;
  return Object.keys(base).length ? JSON.stringify(base) : null;
}

/** Busy = away on an errand that has not finished yet. */
export function isOnErrand(profileJson: string | null | undefined, nowMs: number): boolean {
  const e = readErrand(profileJson);
  return !!e && e.endsAt > nowMs;
}

/** "Se queda en el barco": the nakama does not come along (no fights, not in the scene). Stored next to the errand, never replacing the sheet. */
export function readStay(profileJson: string | null | undefined): boolean {
  if (!profileJson) return false;
  try {
    return (JSON.parse(profileJson) as Record<string, unknown>)?.stay === true;
  } catch {
    return false;
  }
}

export function writeStay(profileJson: string | null | undefined, stay: boolean): string | null {
  let base: Record<string, unknown> = {};
  try {
    const parsed = profileJson ? JSON.parse(profileJson) : {};
    if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>;
  } catch {
    base = {};
  }
  if (stay) base.stay = true;
  else delete base.stay;
  return Object.keys(base).length ? JSON.stringify(base) : null;
}

/** A nakama fights and appears beside the player only when they are neither away on an errand nor staying behind. */
export function isWithPlayer(profileJson: string | null | undefined, nowMs: number): boolean {
  return !isOnErrand(profileJson, nowMs) && !readStay(profileJson);
}

/** Picks who comes along: exactly one companion goes, everyone else stays; null = everyone comes. */
export function focusPlan(ids: string[], chosenId: string | null): Record<string, boolean> {
  const plan: Record<string, boolean> = {};
  for (const id of ids) plan[id] = chosenId !== null && id !== chosenId;
  return plan;
}

export function errandDone(e: Errand, nowMs: number): boolean {
  return e.endsAt <= nowMs;
}
