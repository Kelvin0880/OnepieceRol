import { Rng } from "./rng";

/**
 * Island missions: every island hands each character a few concrete goals
 * scaled to their level, so nobody is left wondering what to do next.
 * Pure rules here (generation, scaling, progress); game/missions.ts stores them.
 */

export type MissionKind = "explore" | "win_fights" | "train" | "spare" | "travel";

export interface MissionSpec {
  kind: MissionKind;
  title: string;
  brief: string;
  target: number;
  tier: number;
  berries: number;
  xp: number;
  destination?: string;
  isArc: boolean;
}

export interface MissionContext {
  level: number;
  danger: number;
  minLevel: number;
  islandName: string;
  arcHook?: string | null;
  /** Names of neighbouring islands this character may already enter. */
  openNeighbours: string[];
}

export const MISSION_BATCH_COOLDOWN_MS = 30 * 60_000;
export const MAX_ACTIVE_PER_ISLAND = 3;

/** How far above the island's entry level the character already is decides how demanding the goals are. */
export function missionTier(level: number, minLevel: number): 1 | 2 | 3 {
  const band = level - minLevel;
  return band < 5 ? 1 : band < 12 ? 2 : 3;
}

export function missionRewards(tier: number, danger: number, kind: MissionKind) {
  const kindMult = kind === "win_fights" ? 1.4 : kind === "travel" ? 0.8 : 1;
  return {
    berries: Math.round((120 + 60 * danger) * tier * kindMult),
    xp: Math.round((25 * (1 + tier) + 6 * danger) * kindMult),
  };
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Always three goals: the island's own conflict, getting to know the place, and one guide-you-onwards pick. */
export function generateMissionSpecs(rng: Rng, ctx: MissionContext): MissionSpec[] {
  const tier = missionTier(ctx.level, ctx.minLevel);
  const mk = (kind: MissionKind, target: number, title: string, brief: string, extra: Partial<MissionSpec> = {}): MissionSpec => ({
    kind,
    target,
    title,
    brief,
    tier,
    ...missionRewards(tier, ctx.danger, kind),
    isArc: false,
    ...extra,
  });

  const arcBrief = ctx.arcHook
    ? `${clip(ctx.arcHook, 220)} Derrota a ${1 + tier} de quienes sostienen este conflicto y cambia el rumbo de ${ctx.islandName}.`
    : `Derrota a ${1 + tier} enemigos que amenazan ${ctx.islandName}.`;
  const specs: MissionSpec[] = [
    mk("win_fights", 1 + tier, `La amenaza de ${ctx.islandName}`, arcBrief, { isArc: true }),
    mk("explore", 2 + tier, `Reconoce ${ctx.islandName}`, `Recorre la isla ${2 + tier} veces: habla con la gente, husmea y descubre qué se cuece de verdad.`),
  ];

  const options: MissionSpec[] = [
    mk("train", 1, "Entrena tu cuerpo", "Dedica un rato a entrenar. Sin fuerza, esta isla te devorará."),
    mk("spare", 1, "Muestra clemencia", "Derrota a un enemigo digno y perdónale la vida. El mar recuerda a quien perdona."),
  ];
  if (ctx.openNeighbours.length > 0) {
    const dest = ctx.openNeighbours[Math.floor(rng() * ctx.openNeighbours.length)];
    options.push(mk("travel", 1, `Traza tu próxima ruta`, `Zarpa hacia ${dest} y descubre lo que te espera allí.`, { destination: dest }));
  }
  specs.push(options[Math.floor(rng() * options.length)]);
  return specs;
}

export interface MissionProgress {
  kind: MissionKind;
  progress: number;
  target: number;
  destination?: string | null;
}

export type MissionEvent = { kind: "explore" } | { kind: "win" } | { kind: "train" } | { kind: "spare" } | { kind: "travel"; destination: string };

/** How much one event advances a mission (0 when unrelated). */
export function progressGain(m: MissionProgress, e: MissionEvent): number {
  if (e.kind === "explore") return m.kind === "explore" ? 1 : 0;
  if (e.kind === "win") return m.kind === "win_fights" ? 1 : 0;
  if (e.kind === "train") return m.kind === "train" ? 1 : 0;
  if (e.kind === "spare") return m.kind === "spare" ? 1 : 0;
  return m.kind === "travel" && m.destination === e.destination ? 1 : 0;
}

export const isComplete = (progress: number, target: number) => progress >= target;

/** A new batch only once nothing is left active here and the previous batch has aged, so missions guide rather than farm. */
export function shouldGenerateBatch(activeHere: number, lastBatchAtMs: number | null, nowMs: number): boolean {
  if (activeHere > 0) return false;
  return lastBatchAtMs === null || nowMs - lastBatchAtMs >= MISSION_BATCH_COOLDOWN_MS;
}
