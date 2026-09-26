/**
 * World events ("Eventos mundiales"): slow, multi-chapter arcs that can end in the
 * death or capture of a canon character. The AI never decides that outcome. The arc
 * builds context over many chapters (rumor -> mobilization -> clash -> escalation ->
 * siege -> ultimatum), each spaced hours apart and each published as its own news
 * item with a location; at the ultimatum the arc STOPS and asks the game owner for
 * consent. Only an approved verdict is narrated as fact. Pure: no DB, no AI.
 */
import type { Rng } from "./rng";

export const ARC_TOTAL_STAGES = 6;
export const ARC_BEAT_GAP_MS = 8 * 60 * 60 * 1000;
export const ARC_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const ARC_MIN_HEAT = 20;
export const ARC_START_CHANCE_PER_TICK = 0.02;
export const ARC_CONTEXT_LINES = 8;

/** reclaim = a defeated former Yonko goes for a sitting Yonko's throne; reclaim_lost = it failed and the owner decides the aspirant's fate. */
/** player_verdict = a player beat a canon character and asks for capture/death; the owner confirms. */
export type ArcKind = "death" | "capture" | "reclaim" | "reclaim_lost" | "player_verdict" | "breakout" | "crew_rescue";
export type ArcOutcome = "death" | "capture" | "survived" | "reclaimed" | "freed" | "held";

/** breakout = a prisoner tries to escape alone; crew_rescue = their own people raid the prison. Both end by themselves (freed / held), no verdict. */
export const isPrisonKind = (k: string) => k === "breakout" || k === "crew_rescue";

/** The kind the narrator prompts understand. */
export function narrationKind(kind: ArcKind): "death" | "capture" {
  return kind === "death" ? "death" : "capture";
}

/** Former emperors who are out of power (status DEFEATED) and can only get the title back by taking it. */
export const RECLAIM_ASPIRANTS = ["Kaido", "Charlotte Linlin (Big Mom)"];

/** A defeated aspirant against a sitting canon Yonko. Null when nobody qualifies. */
export function pickReclaimCast(rng: Rng, actors: ArcActor[]): { target: ArcActor; aggressor: ArcActor; kind: ArcKind } | null {
  const aspirants = actors.filter((a) => a.status === "DEFEATED" && RECLAIM_ASPIRANTS.includes(a.name));
  const sitting = actors.filter((a) => a.status === "ACTIVE" && a.role === "YONKO");
  if (aspirants.length === 0 || sitting.length === 0) return null;
  return { aggressor: aspirants[Math.floor(rng() * aspirants.length)], target: sitting[Math.floor(rng() * sitting.length)], kind: "reclaim" };
}

/** Who wins the throne fight: defenders that saved the day win; otherwise the judge's pick (a = aspirant). */
export function reclaimAspirantWins(tilt: "saved" | "none" | string, judgeSaysAspirant: boolean): boolean {
  return tilt === "saved" ? false : judgeSaysAspirant;
}
export type ChapterKind = "rumor" | "mobilization" | "clash" | "escalation" | "siege" | "ultimatum";

export interface Chapter {
  kind: ChapterKind;
  label: string;
  /** Instruction for the narrator: what this chapter shows (never the ending). */
  brief: string;
}

export const CHAPTERS: Chapter[] = [
  { kind: "rumor", label: "Rumores", brief: "Empiezan a circular rumores inquietantes en torno a {target}: testigos, avistamientos y una tensión que nadie sabe explicar todavía. Nada grave ha ocurrido aún." },
  { kind: "mobilization", label: "Movilización", brief: "{aggressor} moviliza fuerzas y recursos contra {target}: flotas que zarpan, órdenes selladas, aliados que se posicionan." },
  { kind: "clash", label: "Primer choque", brief: "Primer choque directo entre gente de {aggressor} y de {target}: bajas menores y daños en el lugar; nadie decisivo cae. Ambos bandos salen tocados." },
  { kind: "escalation", label: "Escalada", brief: "El conflicto escala: neutrales toman partido, se pierde un enclave importante o hay una traición dentro de un bando. {target} pierde terreno pero sigue en pie." },
  { kind: "siege", label: "Asedio", brief: "{target} queda acorralado en un lugar clave y el cerco se estrecha. El mundo contiene el aliento. Nada está decidido todavía." },
  { kind: "ultimatum", label: "Punto de no retorno", brief: "Se acerca el desenlace: {aggressor} y {target} se enfrentan en el lugar del cerco. Narra solo la tensión y los preparativos finales; NO reveles ni insinúes el resultado." },
];

export const PRISON_TOTAL_STAGES = 5;
export const PRISON_MIN_HELD_MS = 12 * 60 * 60 * 1000;
export const PRISON_ARC_CHANCE = 0.45;

export const BREAKOUT_CHAPTERS: Chapter[] = [
  { kind: "rumor", label: "Rumores de celda", brief: "En Impel Down se comenta que {target} no se ha rendido: los carceleros notan movimientos raros, notas escondidas y un preso que no deja de vigilar las rondas. {target} sigue encerrado." },
  { kind: "mobilization", label: "El plan", brief: "{target} prepara su fuga desde dentro: gana aliados entre los presos, estudia los turnos de guardia y espera su momento. Sigue encerrado." },
  { kind: "clash", label: "Disturbio", brief: "Estalla un disturbio en el nivel de {target}: alarmas, celdas forzadas, carceleros al límite. La guardia contiene lo peor. {target} sigue preso." },
  { kind: "escalation", label: "La fuga", brief: "{target} rompe su celda y se abre paso por los pasillos con una tropa de presos, mientras {aggressor} y sus carceleros intentan cerrarle el paso. Nada está decidido." },
  { kind: "ultimatum", label: "El último corredor", brief: "{target} está a un paso de la salida y {aggressor} cierra el último corredor. Narra solo la tensión y los preparativos; NO reveles si logra escapar ni si lo detienen." },
];

export const RESCUE_CHAPTERS: Chapter[] = [
  { kind: "rumor", label: "Rumores de rescate", brief: "Corren rumores de que la gente de {target} no piensa dejarlo pudrirse en Impel Down: barcos que zarpan de noche y mensajes sellados. {target} sigue encerrado." },
  { kind: "mobilization", label: "Movilización", brief: "{aggressor} reúne barcos y aliados para sacar a {target} de Impel Down. La Marina sospecha y refuerza la vigilancia. {target} sigue preso." },
  { kind: "clash", label: "Primer asalto", brief: "Los hombres de {aggressor} rozan las defensas de Impel Down: escaramuzas, bajas menores sin nombre y daños en el perímetro. {target} sigue encerrado." },
  { kind: "escalation", label: "Asalto a la prisión", brief: "{aggressor} irrumpe en Impel Down y abre brecha nivel a nivel mientras la guardia resiste. {target} oye el estruendo desde su celda. Nada está decidido." },
  { kind: "ultimatum", label: "Ante la celda", brief: "{aggressor} llega hasta el nivel de {target} y se enfrenta a la última guardia. Narra solo la tensión y los preparativos; NO reveles el resultado." },
];

export function chaptersFor(kind: string): Chapter[] {
  return kind === "breakout" ? BREAKOUT_CHAPTERS : kind === "crew_rescue" ? RESCUE_CHAPTERS : CHAPTERS;
}

export function chapterAt(stage: number, kind = "death"): Chapter {
  const list = chaptersFor(kind);
  return list[Math.max(0, Math.min(list.length - 1, stage - 1))];
}

export interface PrisonerView {
  id: string;
  name: string;
  factionName: string;
  powerLevel: number;
  capturedAt: Date | null;
  prisonLevel: number | null;
}

const crewName = (f: string) => f.replace(/\s*\(.*\)\s*$/, "").trim();

/** A canon prisoner held long enough starts an attempt: with a strong free ally of their own crew it is a rescue, otherwise they try alone. Never invents anyone. */
export function pickPrisonCast(rng: Rng, prisoners: PrisonerView[], actors: (ArcActor & { factionName: string })[], warden: ArcActor | null, now: Date): { target: PrisonerView; aggressor: ArcActor | null; kind: ArcKind } | null {
  const ripe = prisoners.filter((p) => p.capturedAt && now.getTime() - p.capturedAt.getTime() >= PRISON_MIN_HELD_MS);
  if (ripe.length === 0) return null;
  const target = ripe[Math.floor(rng() * ripe.length)];
  const allies = actors.filter((a) => a.status === "ACTIVE" && a.id !== target.id && crewName(a.factionName) === crewName(target.factionName) && a.powerLevel >= target.powerLevel * 0.6);
  if (allies.length > 0 && rng() < 0.65) {
    const ally = [...allies].sort((x, y) => y.powerLevel - x.powerLevel || x.name.localeCompare(y.name))[0];
    return { target, aggressor: ally, kind: "crew_rescue" };
  }
  return { target, aggressor: warden, kind: "breakout" };
}

/** Strength of the prison at a given level: a cell 6 with the whole staff is far harder than a cell 1. */
export function prisonDefensePower(cell: number, wardenPower: number): number {
  return Math.round(wardenPower * (0.8 + 0.05 * Math.max(1, Math.min(6, cell))));
}

export function fillBrief(brief: string, target: string, aggressor: string | null | undefined): string {
  return brief.replace(/\{target\}/g, target).replace(/\{aggressor\}/g, aggressor ?? "sus enemigos");
}

export interface ArcState {
  status: string;
  nextBeatAt: Date;
  stage: number;
  totalStages: number;
}

/** A chapter is owed only while the arc is running and its time has come. */
export function arcDue(arc: ArcState, now: Date): boolean {
  return arc.status === "ACTIVE" && arc.stage < arc.totalStages && now.getTime() >= arc.nextBeatAt.getTime();
}

export function nextBeatTime(now: Date, rng: Rng, gapMs = ARC_BEAT_GAP_MS): Date {
  return new Date(now.getTime() + Math.round(gapMs * (0.75 + rng() * 0.5)));
}

export interface ArcActor {
  id: string;
  name: string;
  role: string;
  status: string;
  factionType: string;
  powerLevel: number;
}

/** Endgame pieces and the untouchable top of the Government are never raffled into an arc. */
const PROTECTED_ROLES = new Set(["GOROSEI", "HIDDEN_RULER"]);
const PROTECTED_NAMES = new Set(["Thalassa", "Saint Jaygarcia Saturn", "El Rey Sin Nombre"]);

export function arcEligible(a: ArcActor): boolean {
  return a.status === "ACTIVE" && !PROTECTED_ROLES.has(a.role) && !PROTECTED_NAMES.has(a.name) && ["PIRATE", "MARINE", "REVOLUTIONARY", "CIPHER_POL", "BOUNTY_HUNTER"].includes(a.factionType);
}

/** Which factions plausibly go after a target, and how it would end. */
function rivalsOf(target: ArcActor, rng: Rng): { factions: string[]; kind: ArcKind } {
  switch (target.factionType) {
    case "PIRATE":
      return rng() < 0.6 ? { factions: ["MARINE", "CIPHER_POL"], kind: "capture" } : { factions: ["PIRATE"], kind: "death" };
    case "MARINE":
      return { factions: ["PIRATE", "REVOLUTIONARY"], kind: "death" };
    case "REVOLUTIONARY":
      return { factions: ["MARINE", "CIPHER_POL"], kind: "capture" };
    case "CIPHER_POL":
      return { factions: ["REVOLUTIONARY"], kind: "death" };
    default:
      return { factions: ["PIRATE", "MARINE"], kind: rng() < 0.5 ? "capture" : "death" };
  }
}

export interface ArcCast {
  target: ArcActor;
  aggressor: ArcActor;
  kind: ArcKind;
}

/** Kept alive on purpose for the story: when a world event starts they are far more likely to star in it. */
export const FEATURED_ACTOR_NAMES = ["Kaido", "Charlotte Linlin (Big Mom)"];
export const FEATURED_CHANCE = 0.5;

/** Picks a credible clash: a target and a rival of comparable weight. Null when the world has no such pair. */
export function pickArcCast(rng: Rng, actors: ArcActor[], featured: string[] = []): ArcCast | null {
  const pool = actors.filter(arcEligible);
  if (pool.length < 2) return null;
  const stars = pool.filter((a) => featured.includes(a.name));
  for (let attempt = 0; attempt < 12; attempt++) {
    const target = stars.length > 0 && rng() < FEATURED_CHANCE ? stars[Math.floor(rng() * stars.length)] : pool[Math.floor(rng() * pool.length)];
    const { factions, kind } = rivalsOf(target, rng);
    const rivals = pool.filter((a) => a.id !== target.id && factions.includes(a.factionType) && a.powerLevel >= target.powerLevel - 20);
    if (rivals.length === 0) continue;
    return { target, aggressor: rivals[Math.floor(rng() * rivals.length)], kind };
  }
  return null;
}

export interface StartContext {
  hasOpenArc: boolean;
  lastResolvedAt: Date | null;
  heat: number;
  now: Date;
}

/** Rare by design: one arc at a time, a long quiet period after each, and a world hot enough to allow it. */
export function shouldStartArc(rng: Rng, ctx: StartContext): boolean {
  if (ctx.hasOpenArc) return false;
  if (ctx.heat < ARC_MIN_HEAT) return false;
  if (ctx.lastResolvedAt && ctx.now.getTime() - ctx.lastResolvedAt.getTime() < ARC_COOLDOWN_MS) return false;
  return rng() < ARC_START_CHANCE_PER_TICK;
}

export function arcTitle(kind: ArcKind, target: string, aggressor: string): string {
  if (kind === "reclaim") return `${aggressor} va por el trono de ${target}`;
  if (kind === "breakout") return `La fuga de ${target}`;
  if (kind === "crew_rescue") return `${aggressor} va a por ${target}`;
  return kind === "capture" ? `La caza de ${target}` : `${target} contra ${aggressor}`;
}

export function appendContext(lines: string[], line: string, max = ARC_CONTEXT_LINES): string[] {
  return [...lines, line].slice(-max);
}

export function outcomeActorStatus(outcome: ArcOutcome, current = "ACTIVE"): "DECEASED" | "CAPTURED" | "ACTIVE" | "DEFEATED" {
  if (outcome === "death") return "DECEASED";
  if (outcome === "capture") return "CAPTURED";
  return current === "DEFEATED" ? "DEFEATED" : "ACTIVE";
}

export function verdictOutcome(kind: ArcKind, approved: boolean): ArcOutcome {
  if (!approved) return "survived";
  return kind === "death" ? "death" : "capture";
}

/**
 * Where each chapter takes place: the target's turf first, then the aggressor's, the clash back on the target's
 * ground, the escalation one hop away, and the siege/ultimatum at a chokepoint next to it.
 */
export function chapterLocation(stage: number, spots: { target: string | null; aggressor: string | null; nearTarget: string | null; siege: string | null }): string | null {
  switch (stage) {
    case 1: return spots.target;
    case 2: return spots.aggressor ?? spots.target;
    case 3: return spots.target;
    case 4: return spots.nearTarget ?? spots.target;
    default: return spots.siege ?? spots.nearTarget ?? spots.target;
  }
}
