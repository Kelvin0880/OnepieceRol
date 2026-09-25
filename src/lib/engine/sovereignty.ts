import { actorCombatStats } from "./guardian";
import type { FactionKey } from "./progression";

/**
 * The sovereign powers a player can reach: the Four Emperors (Yonko), the Seven Warlords (Shichibukai) and the
 * wars an emperor can declare. Everything here is a fixed rule; who wins a fight is still decided by the
 * referee in the joint fight, and a canon character only dies or is captured with the owner's verdict.
 */

const HOUR = 3600_000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------- Yonko

export const YONKO_SEATS = 4;
export const YONKO_MIN_LEVEL = 35;
export const YONKO_MIN_BOUNTY = 1_000_000_000;
export const YONKO_MIN_TERRITORIES = 1;
export const YONKO_MIN_FORCES = 3;
export const YONKO_CHALLENGE_COOLDOWN_MS = 24 * HOUR;
export const EMPEROR_TITLE = "Yonko";

export interface Requirement {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface EmperorInput {
  faction: FactionKey;
  alive: boolean;
  level: number;
  bounty: number;
  territories: number;
  /** Living crewmates (players) + living NPC nakamas. */
  forces: number;
  isEmperor: boolean;
  isWarlord: boolean;
}

const fmt = (n: number) => n.toLocaleString("es-ES");

export function emperorRequirements(i: EmperorInput): { ok: boolean; checks: Requirement[] } {
  const checks: Requirement[] = [
    { id: "pirate", label: "Ser pirata", met: i.faction === "PIRATE", detail: i.faction === "PIRATE" ? "Navegas bajo tu propia bandera." : "Solo un pirata puede ser Emperador del mar." },
    { id: "level", label: `Nivel ${YONKO_MIN_LEVEL}`, met: i.level >= YONKO_MIN_LEVEL, detail: `Nivel ${i.level}/${YONKO_MIN_LEVEL}` },
    { id: "bounty", label: `Recompensa de ฿ ${fmt(YONKO_MIN_BOUNTY)}`, met: i.bounty >= YONKO_MIN_BOUNTY, detail: `฿ ${fmt(i.bounty)} / ${fmt(YONKO_MIN_BOUNTY)}` },
    { id: "territory", label: `Dominar ${YONKO_MIN_TERRITORIES} isla`, met: i.territories >= YONKO_MIN_TERRITORIES, detail: `${i.territories} isla(s) bajo tu bandera` },
    { id: "forces", label: `Una fuerza de ${YONKO_MIN_FORCES}`, met: i.forces >= YONKO_MIN_FORCES, detail: `${i.forces} tripulantes y nakamas en pie` },
    { id: "free", label: "No servir al Gobierno", met: !i.isWarlord, detail: i.isWarlord ? "Un Shichibukai tiene que renunciar a su patente antes." : "Tu bandera no responde ante nadie." },
  ];
  return { ok: i.alive && !i.isEmperor && checks.every((c) => c.met), checks };
}

/** With an empty throne the world simply acknowledges a pirate who already has everything; otherwise a throne must be taken. */
export function canBeProclaimed(eligible: boolean, emperorsNow: number): boolean {
  return eligible && emperorsNow < YONKO_SEATS;
}

export function challengeBlockReason(p: { eligible: boolean; sameIsland: boolean; targetActive: boolean; targetIsEmperor: boolean; lastChallengeAt: Date | null; now: Date }): string | null {
  if (!p.eligible) return "Todavía no cumples los requisitos de un aspirante a Emperador.";
  if (!p.targetActive || !p.targetIsEmperor) return "Ese rival ya no ocupa un trono de Emperador.";
  if (!p.sameIsland) return "Para desafiar a un Emperador tienes que estar en la misma isla que él.";
  if (p.lastChallengeAt && p.now.getTime() - p.lastChallengeAt.getTime() < YONKO_CHALLENGE_COOLDOWN_MS) {
    const hours = Math.ceil((YONKO_CHALLENGE_COOLDOWN_MS - (p.now.getTime() - p.lastChallengeAt.getTime())) / HOUR);
    return `Tus hombres aún se recuperan del último desafío: espera ${hours} h.`;
  }
  return null;
}

/** An emperor fought in person: tougher than any territory holder of the same power. */
export function emperorEnemyStats(powerLevel: number) {
  const s = actorCombatStats(powerLevel);
  return { hp: Math.round(s.hp * 1.4), atk: Math.round(s.atk * 1.2), def: Math.round(s.def * 1.2), spd: Math.round(s.spd * 1.1) };
}

export function emperorChallengeRewards(islandDanger: number) {
  return { berries: 50_000 * Math.max(1, islandDanger), xp: 1_200, bounty: 500_000_000, islandDanger };
}

export type FallenFate = "spare" | "capture" | "kill";

export function parseFallenFate(raw: unknown): FallenFate | null {
  return raw === "spare" || raw === "capture" || raw === "kill" ? raw : null;
}

// ---------------------------------------------------------------- Shichibukai

export const WARLORD_SEATS = 7;
export const WARLORD_MIN_LEVEL = 20;
export const WARLORD_MIN_BOUNTY = 100_000_000;
export const WARLORD_TRIBUTE_PERIOD_MS = 7 * DAY;
export const WARLORD_TRIBUTE_GRACE_MS = DAY;
export const WARLORD_REAPPLY_COOLDOWN_MS = 7 * DAY;
export const WARLORD_REVOKE_BOUNTY_FACTOR = 1.2;
export const WARLORD_TITLE = "Shichibukai";

export interface WarlordInput {
  faction: FactionKey;
  alive: boolean;
  imprisoned: boolean;
  level: number;
  bounty: number;
  isEmperor: boolean;
  isWarlord: boolean;
  seatsTaken: number;
  revokedAt: Date | null;
  now: Date;
}

export function warlordRequirements(i: WarlordInput): { ok: boolean; checks: Requirement[] } {
  const cooling = !!i.revokedAt && i.now.getTime() - i.revokedAt.getTime() < WARLORD_REAPPLY_COOLDOWN_MS;
  const checks: Requirement[] = [
    { id: "pirate", label: "Ser pirata", met: i.faction === "PIRATE", detail: i.faction === "PIRATE" ? "El Gobierno solo firma patentes con piratas." : "Solo los piratas pueden ser Shichibukai." },
    { id: "level", label: `Nivel ${WARLORD_MIN_LEVEL}`, met: i.level >= WARLORD_MIN_LEVEL, detail: `Nivel ${i.level}/${WARLORD_MIN_LEVEL}` },
    { id: "bounty", label: `Recompensa de ฿ ${fmt(WARLORD_MIN_BOUNTY)}`, met: i.bounty >= WARLORD_MIN_BOUNTY, detail: `฿ ${fmt(i.bounty)} / ${fmt(WARLORD_MIN_BOUNTY)}` },
    { id: "seat", label: "Un asiento libre", met: i.seatsTaken < WARLORD_SEATS, detail: `${i.seatsTaken}/${WARLORD_SEATS} asientos ocupados` },
    { id: "free", label: "Ni Emperador ni preso", met: !i.isEmperor && !i.imprisoned, detail: i.isEmperor ? "Un Yonko no se arrodilla ante el Gobierno." : i.imprisoned ? "Desde una celda no se firma nada." : "Libre para negociar." },
    { id: "trust", label: "Sin traición reciente", met: !cooling, detail: cooling ? "El Gobierno aún recuerda tu última traición." : "Tu historial con el Gobierno está limpio." },
  ];
  return { ok: i.alive && !i.isWarlord && checks.every((c) => c.met), checks };
}

/** 1% of the bounty, at least one million: the Government's cut for looking the other way. */
export function warlordTribute(bounty: number): number {
  return Math.max(1_000_000, Math.round(bounty * 0.01));
}

export function tributeState(dueAt: Date | null, now: Date): "ok" | "due" | "overdue" {
  if (!dueAt) return "ok";
  const t = now.getTime() - dueAt.getTime();
  if (t < 0) return "ok";
  return t > WARLORD_TRIBUTE_GRACE_MS ? "overdue" : "due";
}

export function revokedBounty(bounty: number): number {
  return Math.round(bounty * WARLORD_REVOKE_BOUNTY_FACTOR);
}

/** A warlord's licence: the Government's own forces don't hunt them. */
export function governmentSparesWarlord(hunterFaction: FactionKey, targetIsWarlord: boolean): boolean {
  return targetIsWarlord && (hunterFaction === "MARINE" || hunterFaction === "CP0");
}

// ---------------------------------------------------------------- Wars

export const WAR_DURATION_MS = 7 * DAY;
export const WAR_WIN_SCORE = 3;
export const WAR_DECLARE_COOLDOWN_MS = 3 * DAY;
export type WarKind = "MARINE" | "EMPEROR";

export interface WarScore {
  attacker: number;
  defender: number;
}

export function warOutcome(score: WarScore, startedAt: Date, now: Date): "attacker" | "defender" | "stalemate" | null {
  if (score.attacker >= WAR_WIN_SCORE) return "attacker";
  if (score.defender >= WAR_WIN_SCORE) return "defender";
  if (now.getTime() - startedAt.getTime() < WAR_DURATION_MS) return null;
  if (score.attacker === score.defender) return "stalemate";
  return score.attacker > score.defender ? "attacker" : "defender";
}

/** A Marine base is any island whose controlling power is the Marines or the World Government. */
export function isMarineBase(factionControl: string | null | undefined): boolean {
  return /marina|marine|gobierno mundial/i.test(factionControl ?? "");
}

export function baseGarrisonStats(islandDanger: number, attackerLevel: number) {
  const power = Math.min(100, 30 + islandDanger * 5 + Math.round(attackerLevel / 2));
  return actorCombatStats(power);
}

/** A territory held by a rival emperor is defended by its garrison and by its owner's reputation. */
export function rivalGarrisonStats(garrison: number, ownerLevel: number) {
  const power = Math.min(100, 25 + Math.round(garrison / 3) + ownerLevel);
  return actorCombatStats(power);
}

export function warRewards(kind: WarKind, islandDanger: number) {
  return { berries: 30_000 * Math.max(1, islandDanger), xp: 400, bounty: kind === "MARINE" ? 150_000_000 : 80_000_000, islandDanger };
}

export function declareWarBlockReason(p: { isEmperor: boolean; hasOpenWar: boolean; lastWarEndedAt: Date | null; targetIsEmperor?: boolean; targetIsSelf?: boolean; now: Date }): string | null {
  if (!p.isEmperor) return "Solo un Yonko puede declarar una guerra abierta.";
  if (p.hasOpenWar) return "Ya estás en guerra: termina esa antes de abrir otro frente.";
  if (p.targetIsSelf) return "No puedes declararte la guerra a ti mismo.";
  if (p.targetIsEmperor === false) return "Solo puedes declarar la guerra a otro Yonko.";
  if (p.lastWarEndedAt && p.now.getTime() - p.lastWarEndedAt.getTime() < WAR_DECLARE_COOLDOWN_MS) return "Tu flota aún se recupera de la última guerra.";
  return null;
}

// ---------------------------------------------------------------- World figures

export interface FigureInput {
  faction: FactionKey;
  bounty: number;
  notoriety: number;
  isEmperor: boolean;
  isWarlord: boolean;
}

/**
 * Who the papers follow everywhere. Cipher Pol only becomes public at the very top (World Nobles and the Elders);
 * below that its agents are, by design, nobody.
 */
export function isWorldFigure(i: FigureInput): boolean {
  if (i.isEmperor || i.isWarlord) return true;
  switch (i.faction) {
    case "PIRATE":
      return i.bounty >= 500_000_000;
    case "MARINE":
      return i.notoriety >= 7_000;
    case "REVOLUTIONARY":
      return i.notoriety >= 2_400;
    case "BOUNTY_HUNTER":
      return i.notoriety >= 1_300;
    case "CP0":
      return i.notoriety >= 6_000;
  }
}

export const FIGURE_NEWS_GAP_MS = 45 * 60_000;

export function figureNewsDue(lastAt: Date | null, now: Date): boolean {
  return !lastAt || now.getTime() - lastAt.getTime() >= FIGURE_NEWS_GAP_MS;
}

export function figureLabel(i: FigureInput, rankTitle: string): string {
  if (i.isEmperor) return "el Yonko";
  if (i.isWarlord) return "el Shichibukai";
  return rankTitle;
}
