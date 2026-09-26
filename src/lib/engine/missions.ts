import { Rng } from "./rng";

/**
 * Island missions: every island hands each character a few concrete goals
 * scaled to their level, so nobody is left wondering what to do next.
 * Pure rules here (generation, scaling, progress); game/missions.ts stores them.
 */

export type MissionKind = "explore" | "win_fights" | "train" | "spare" | "travel" | "defeat_npc";

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
  /** Island residents this goal is about: who asks for it and who must fall. */
  giverNpcId?: string;
  targetNpcId?: string;
}

export interface MissionContext {
  level: number;
  danger: number;
  minLevel: number;
  islandName: string;
  arcHook?: string | null;
  /** Names of neighbouring islands this character may already enter. */
  openNeighbours: string[];
  /** Free residents of the island: goals name real people instead of generic enemies. */
  residents?: { id: string; name: string; title: string; category: string; level: number }[];
}

export const MISSION_BATCH_COOLDOWN_MS = 30 * 60_000;
export const MAX_ACTIVE_PER_ISLAND = 3;

/** How far above the island's entry level the character already is decides how demanding the goals are. */
export function missionTier(level: number, minLevel: number): 1 | 2 | 3 {
  const band = level - minLevel;
  return band < 5 ? 1 : band < 12 ? 2 : 3;
}

/** Island goals are the main way to level early: they pay two and a half times the base experience. */
export const MISSION_XP_BOOST = 2.5;

export function missionRewards(tier: number, danger: number, kind: MissionKind) {
  const kindMult = kind === "win_fights" ? 1.4 : kind === "travel" ? 0.8 : 1;
  return {
    berries: Math.round((120 + 60 * danger) * tier * kindMult),
    xp: Math.round((25 * (1 + tier) + 6 * danger) * kindMult * MISSION_XP_BOOST),
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
  const fighters = (ctx.residents ?? []).filter((r) => ["thug", "pirate", "guard", "marine"].includes(r.category) && r.level <= ctx.level + 8);
  const enemyPool = fighters.filter((r) => r.category === "thug" || r.category === "pirate");
  const target = (enemyPool.length ? enemyPool : fighters).length ? [...(enemyPool.length ? enemyPool : fighters)].sort((a, b) => b.level - a.level)[Math.floor(rng() * Math.min(2, (enemyPool.length ? enemyPool : fighters).length))] : null;
  const givers = (ctx.residents ?? []).filter((r) => ["civilian", "merchant", "official"].includes(r.category));
  const giver = givers.length ? givers[Math.floor(rng() * givers.length)] : null;
  const arc: MissionSpec = target
    ? mk("defeat_npc", 1, `Acaba con ${target.name}`, `${giver ? `${giver.name} (${giver.title}) te lo pide: ` : ""}${target.name}, ${target.title.toLowerCase()}, es el problema de ${ctx.islandName}. ${ctx.arcHook ? clip(ctx.arcHook, 200) : ""} Véncelo (o entrégalo a la ley) y cambia el rumbo de la isla.`.replace(/  +/g, " "), {
        isArc: true,
        targetNpcId: target.id,
        giverNpcId: giver?.id,
        berries: Math.round(missionRewards(tier, ctx.danger, "win_fights").berries + target.level * 25),
        xp: Math.round(missionRewards(tier, ctx.danger, "win_fights").xp + target.level * 3 * MISSION_XP_BOOST),
      })
    : mk("win_fights", 1 + tier, `La amenaza de ${ctx.islandName}`, arcBrief, { isArc: true });
  const specs: MissionSpec[] = [
    arc,
    mk("explore", 2 + tier, `Reconoce ${ctx.islandName}`, `Recorre la isla ${2 + tier} veces: habla con la gente${giver && giver.id !== arc.giverNpcId ? `, empezando por ${giver.name} (${giver.title})` : ""}, husmea y descubre qué se cuece de verdad.`, giver && giver.id !== arc.giverNpcId ? { giverNpcId: giver.id } : {}),
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
  targetNpcId?: string | null;
}

export type MissionEvent = { kind: "explore" } | { kind: "npc"; npcId: string } | { kind: "win" } | { kind: "train" } | { kind: "spare" } | { kind: "travel"; destination: string };

/** How much one event advances a mission (0 when unrelated). */
export function progressGain(m: MissionProgress, e: MissionEvent): number {
  if (e.kind === "explore") return m.kind === "explore" ? 1 : 0;
  if (e.kind === "npc") return m.kind === "defeat_npc" && !!m.targetNpcId && m.targetNpcId === e.npcId ? 1 : 0;
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
