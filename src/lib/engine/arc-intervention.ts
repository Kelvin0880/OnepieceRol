/**
 * Players can step into a world event ("como en el anime"): if they have the level and are standing where it
 * happens, they can defend the target, back the aggressor or sow chaos against both. They fight a vanguard
 * (never the canon character in person); winning tips the story. Pure: no DB.
 */
import { actorCombatStats } from "./guardian";

export type InterventionSide = "defend" | "assist" | "chaos";
export const INTERVENTION_SIDES: InterventionSide[] = ["defend", "assist", "chaos"];
export const MIN_INTERVENTION_STAGE = 3;
/** Score the defenders need to save the target without anyone's verdict. */
export const SAVE_THRESHOLD = 3;

export interface Contribution {
  characterId: string;
  name: string;
  side: InterventionSide;
  stage: number;
  level: number;
}

export function isInterventionSide(v: unknown): v is InterventionSide {
  return typeof v === "string" && (INTERVENTION_SIDES as string[]).includes(v);
}

/** Below this level you would just be in the way: roughly a third of the weaker side's power. */
export function interventionMinLevel(targetPower: number, aggressorPower: number): number {
  return Math.max(10, Math.round(Math.min(targetPower, aggressorPower) / 3));
}

export interface InterventionCheck {
  arcStatus: string;
  stage: number;
  totalStages: number;
  playerIslandId: string;
  arcIslandId: string | null;
  level: number;
  minLevel: number;
  alreadyThisStage: boolean;
}

export function interventionBlockReason(c: InterventionCheck): string | null {
  if (c.arcStatus !== "ACTIVE" && c.arcStatus !== "AWAITING_CONSENT") return "Ese evento ya terminó.";
  if (c.stage < MIN_INTERVENTION_STAGE) return "Todavía es pronto: la situación no ha estallado. Vuelve cuando haya un choque abierto.";
  if (!c.arcIslandId || c.arcIslandId !== c.playerIslandId) return "El suceso ocurre en otro lugar: tienes que estar allí para intervenir.";
  if (c.level < c.minLevel) return `Aún no tienes nivel para meterte en esto (mínimo ${c.minLevel}).`;
  if (c.alreadyThisStage) return "Ya intervinieron por ti en este capítulo; espera al siguiente.";
  return null;
}

export interface Vanguard {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss: boolean;
  level: number;
}

/**
 * The force a player faces: the aggressor's vanguard (defend), the target's guard (assist) or both at once (chaos).
 * Deliberately a fraction of the canon character's own power: a subordinate, never the real thing.
 */
export function vanguardFor(side: InterventionSide, target: { name: string; power: number }, aggressor: { name: string; power: number }, stage: number): Vanguard {
  const basePower = side === "defend" ? aggressor.power : side === "assist" ? target.power : Math.round((target.power + aggressor.power) / 2);
  const scaled = Math.round(basePower * (0.5 + 0.03 * Math.min(6, stage)));
  const s = actorCombatStats(scaled);
  const name = side === "defend" ? `Vanguardia de ${aggressor.name}` : side === "assist" ? `Guardia de ${target.name}` : `Fuerzas de ${aggressor.name} y de ${target.name}`;
  return { name, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, isBoss: true, level: Math.max(5, Math.round(scaled / 2.6)) };
}

/** One winning fight = one point; chaos counts half for the target's escape and half against the aggressor's grip. */
export function tally(contribs: Contribution[]): { defend: number; assist: number } {
  let defend = 0;
  let assist = 0;
  for (const c of contribs) {
    if (c.side === "defend") defend += 1;
    else if (c.side === "assist") assist += 1;
    else defend += 0.5;
  }
  return { defend, assist };
}

export type TiltVerdict = "saved" | "tilted_to_aggressor" | "open";

/** Enough defenders (and more than the aggressor's helpers) save the target outright; otherwise the owner's verdict stands. */
export function interventionTilt(contribs: Contribution[]): TiltVerdict {
  const { defend, assist } = tally(contribs);
  if (defend >= SAVE_THRESHOLD && defend > assist) return "saved";
  if (assist >= SAVE_THRESHOLD && assist > defend) return "tilted_to_aggressor";
  return "open";
}

/** A player can only score once per chapter, however many fights they win. */
export function addContribution(contribs: Contribution[], c: Contribution): Contribution[] {
  if (contribs.some((x) => x.characterId === c.characterId && x.stage === c.stage)) return contribs;
  return [...contribs, c];
}
