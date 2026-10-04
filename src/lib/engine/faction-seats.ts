import { actorCombatStats } from "./guardian";
import type { FactionKey } from "./progression";
import type { Requirement } from "./sovereignty";

/**
 * The top of the Marine, the Revolutionary Army and the World Government are not reached by merit alone: they are
 * seats, a fixed number of them, and the only way in is to beat whoever sits there. Winning swaps the two places
 * (an admiral who beats the fleet admiral takes the post and the old fleet admiral drops to the challenger's admiral
 * seat); winning the lowest seat of a ladder pushes the holder out to the rank below it. Bounty hunters have no seats.
 */

export type SeatId = "ADMIRAL" | "FLEET_ADMIRAL" | "REV_COMMANDER" | "REV_CHIEF" | "REV_LEADER" | "GOROSEI";

export interface SeatDef {
  id: SeatId;
  faction: FactionKey;
  title: string;
  seats: number;
  /** The seat a challenger must already hold; null = the entry seat of the ladder. */
  below: SeatId | null;
  minLevel: number;
  /** Merit / influence / Government trust (Character.notoriety). */
  minMerit: number;
  /** What the holder of an entry seat becomes when they lose it. */
  demotedTitle: string;
  /** Where anyone can present the challenge even if the holder is away: the holder has to answer there. */
  hq: string;
}

export const SEATS: Record<SeatId, SeatDef> = {
  ADMIRAL: { id: "ADMIRAL", faction: "MARINE", title: "Almirante", seats: 3, below: null, minLevel: 40, minMerit: 7_000, demotedTitle: "Vicealmirante", hq: "Nuevo Marineford" },
  FLEET_ADMIRAL: { id: "FLEET_ADMIRAL", faction: "MARINE", title: "Almirante de Flota", seats: 1, below: "ADMIRAL", minLevel: 50, minMerit: 12_000, demotedTitle: "Almirante", hq: "Nuevo Marineford" },
  REV_COMMANDER: { id: "REV_COMMANDER", faction: "REVOLUTIONARY", title: "Comandante del Ejército Revolucionario", seats: 5, below: null, minLevel: 30, minMerit: 1_300, demotedTitle: "Oficial revolucionario", hq: "Isla Baltigo" },
  REV_CHIEF: { id: "REV_CHIEF", faction: "REVOLUTIONARY", title: "Jefe de Estado Mayor", seats: 1, below: "REV_COMMANDER", minLevel: 40, minMerit: 2_400, demotedTitle: "Comandante del Ejército Revolucionario", hq: "Isla Baltigo" },
  REV_LEADER: { id: "REV_LEADER", faction: "REVOLUTIONARY", title: "Líder del Ejército Revolucionario", seats: 1, below: "REV_CHIEF", minLevel: 50, minMerit: 4_200, demotedTitle: "Jefe de Estado Mayor", hq: "Isla Baltigo" },
  GOROSEI: { id: "GOROSEI", faction: "CP0", title: "Gorosei", seats: 5, below: null, minLevel: 50, minMerit: 6_000, demotedTitle: "Ex-Gorosei", hq: "Mary Geoise" },
};

export const SEAT_IDS = Object.keys(SEATS) as SeatId[];

export const LADDER_NAME: Partial<Record<FactionKey, string>> = { MARINE: "Almirantes", REVOLUTIONARY: "Mando revolucionario", CP0: "Los Cinco Ancianos" };

export function isSeatId(v: unknown): v is SeatId {
  return typeof v === "string" && v in SEATS;
}

/** Bottom to top. */
export function ladderFor(faction: FactionKey): SeatDef[] {
  const own = SEAT_IDS.map((id) => SEATS[id]).filter((s) => s.faction === faction);
  const out: SeatDef[] = [];
  let next = own.find((s) => s.below === null);
  while (next) {
    out.push(next);
    const cur: SeatDef = next;
    next = own.find((s) => s.below === cur.id);
  }
  return out;
}

export function seatAbove(seat: SeatId): SeatDef | null {
  return SEAT_IDS.map((id) => SEATS[id]).find((s) => s.below === seat) ?? null;
}

export function seatRank(seat: SeatId | null | undefined): number {
  if (!seat) return -1;
  return ladderFor(SEATS[seat].faction).findIndex((s) => s.id === seat);
}

export const SEAT_CHALLENGE_COOLDOWN_MS = 24 * 3600_000;
export const SEAT_RESPONSE_WINDOW_MS = 24 * 3600_000;
/** How long the world waits for the verdict of a duel between two canon characters. */
export const CANON_SEAT_DUEL_DELAY_MS = 8 * 3600_000;
/** Gap between two seat events started by the world itself (canon against canon, or canon against a player). */
export const CANON_SEAT_EVENT_GAP_MS = 36 * 3600_000;
/** A player who holds a seat is challenged by a canon character at most this often. */
export const PLAYER_DEFENSE_GAP_MS = 72 * 3600_000;

export interface SeatCandidate {
  faction: FactionKey;
  alive: boolean;
  imprisoned: boolean;
  level: number;
  merit: number;
  seat: SeatId | null;
  isEmperor?: boolean;
  isWarlord?: boolean;
}

const fmt = (n: number) => n.toLocaleString("es-ES");
const METRIC: Partial<Record<FactionKey, string>> = { MARINE: "mérito", REVOLUTIONARY: "influencia", CP0: "confianza del Gobierno" };

export function seatRequirements(seatId: SeatId, c: SeatCandidate): { ok: boolean; checks: Requirement[] } {
  const s = SEATS[seatId];
  const metric = METRIC[s.faction] ?? "mérito";
  const checks: Requirement[] = [
    { id: "faction", label: `Ser de la facción`, met: c.faction === s.faction, detail: c.faction === s.faction ? "Es tu propia cadena de mando." : `Solo puede ocuparlo alguien de su facción.` },
    { id: "level", label: `Nivel ${s.minLevel}`, met: c.level >= s.minLevel, detail: `Nivel ${c.level}/${s.minLevel}` },
    { id: "merit", label: `${fmt(s.minMerit)} de ${metric}`, met: c.merit >= s.minMerit, detail: `${fmt(c.merit)} / ${fmt(s.minMerit)}` },
  ];
  if (s.below) {
    const need = SEATS[s.below];
    checks.push({ id: "below", label: `Ser ${need.title}`, met: c.seat === s.below, detail: c.seat === s.below ? `Ya eres ${need.title}.` : `Antes tienes que ganarte un puesto de ${need.title}.` });
  } else {
    checks.push({ id: "below", label: "No tenerlo ya", met: seatRank(c.seat) < seatRank(seatId) || c.seat === null, detail: c.seat ? `Eres ${SEATS[c.seat].title}.` : "Aún sin puesto de mando." });
  }
  checks.push({ id: "free", label: "Libre y en pie", met: c.alive && !c.imprisoned, detail: c.imprisoned ? "Desde una celda no se desafía a nadie." : c.alive ? "Listo para el desafío." : "Los muertos no ascienden." });
  const holdsIt = c.seat === seatId;
  return { ok: !holdsIt && checks.every((x) => x.met), checks };
}

export interface ChallengeBlockInput {
  eligible: boolean;
  targetHoldsSeat: boolean;
  targetIsSelf: boolean;
  sameIsland: boolean;
  atHq: boolean;
  lastChallengeAt: Date | null;
  targetBusy: boolean;
  hasOpenChallenge: boolean;
  now: Date;
}

export function seatChallengeBlock(p: ChallengeBlockInput, seatId: SeatId): string | null {
  const s = SEATS[seatId];
  if (p.targetIsSelf) return "No puedes desafiarte a ti mismo.";
  if (!p.eligible) return "Aún no cumples los requisitos de este puesto.";
  if (!p.targetHoldsSeat) return `Ese rival ya no es ${s.title}.`;
  if (p.hasOpenChallenge) return "Ya hay un desafío en marcha con uno de los dos.";
  if (p.targetBusy) return "Ahora mismo está metido en otro asunto: vuelve a intentarlo más tarde.";
  if (!p.sameIsland && !p.atHq) return `Tienes que estar en su misma isla o presentar el desafío en ${s.hq}.`;
  if (p.lastChallengeAt && p.now.getTime() - p.lastChallengeAt.getTime() < SEAT_CHALLENGE_COOLDOWN_MS) {
    const hours = Math.ceil((SEAT_CHALLENGE_COOLDOWN_MS - (p.now.getTime() - p.lastChallengeAt.getTime())) / 3600_000);
    return `Aún te recuperas de tu último desafío: espera ${hours} h.`;
  }
  return null;
}

export interface SeatHolderRef {
  kind: "player" | "canon";
  id: string;
  seat: SeatId | null;
}

export interface SeatChange {
  who: SeatHolderRef;
  seat: SeatId | null;
  /** Title to show for someone left with no seat (null = keep their normal rank). */
  title: string | null;
}

/**
 * The result of a seat duel. The winner of a challenge takes the seat; the loser takes whatever the challenger held,
 * or, when the challenge was for an entry seat, drops to the rank right below the ladder. A defender who wins keeps
 * everything and nothing changes.
 */
export function seatSwap(seatId: SeatId, challenger: SeatHolderRef, defender: SeatHolderRef, challengerWon: boolean): SeatChange[] {
  if (!challengerWon) return [];
  const s = SEATS[seatId];
  const fallback = challenger.seat && seatRank(challenger.seat) < seatRank(seatId) ? challenger.seat : null;
  return [
    { who: challenger, seat: seatId, title: s.title },
    { who: defender, seat: fallback, title: fallback ? SEATS[fallback].title : s.demotedTitle },
  ];
}

/** A seat holder fought in person: a notch tougher than the same power in the open. */
export function seatHolderStats(powerLevel: number) {
  const s = actorCombatStats(powerLevel);
  return { hp: Math.round(s.hp * 1.25), atk: Math.round(s.atk * 1.1), def: Math.round(s.def * 1.1), spd: s.spd };
}

export function seatRewards(seatId: SeatId, islandDanger: number) {
  const top = SEATS[seatId].below !== null;
  return { berries: (top ? 40_000 : 25_000) * Math.max(1, islandDanger), xp: top ? 900 : 600, bounty: 0, islandDanger };
}

export function seatDuelHeadline(seatId: SeatId, challenger: string, defender: string): string {
  return `${challenger} desafía a ${defender} por el puesto de ${SEATS[seatId].title}`;
}

/** The seat of a canon character, as the seed assigns it the first time (never re-imposed after the world has moved). */
export const CANON_SEATS: Record<string, SeatId> = {
  Sakazuki: "FLEET_ADMIRAL",
  Kizaru: "ADMIRAL",
  Fujitora: "ADMIRAL",
  Ryokugyu: "ADMIRAL",
  "Monkey D. Dragon": "REV_LEADER",
  Sabo: "REV_CHIEF",
  "Belo Betty": "REV_COMMANDER",
  Morley: "REV_COMMANDER",
  Lindbergh: "REV_COMMANDER",
  Karasu: "REV_COMMANDER",
  Hack: "REV_COMMANDER",
  "Saint Jaygarcia Saturn": "GOROSEI",
  "Ethanbaron V. Nusjuro": "GOROSEI",
  "Topman Warcury": "GOROSEI",
  "Marcus Mars": "GOROSEI",
  "Shepherd Ju Peter": "GOROSEI",
};

/** Canon characters without a seat who would challenge for the entry seat of their ladder (the aspirants). */
export function isEntryAspirant(seatId: SeatId, actor: { factionType: string; role: string; rankLabel: string | null; seat: string | null; status: string }): boolean {
  if (actor.status !== "ACTIVE" || actor.seat) return false;
  if (seatId === "ADMIRAL") return actor.factionType === "MARINE" && /^vicealmirante/i.test(actor.rankLabel ?? "");
  if (seatId === "REV_COMMANDER") return actor.factionType === "REVOLUTIONARY" && actor.role === "REVOLUTIONARY_COMMANDER";
  return false;
}

/** Stable pick without dice: the same seed always chooses the same element. */
export function pickBySeed<T>(list: T[], seed: string): T | null {
  if (list.length === 0) return null;
  // FNV-1a plus a final avalanche: with a plain `h*31 + c` hash and a list of 31 entries the pick depended only on the seed's last character.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return list[h % list.length];
}

// ---------------------------------------------------------------- wars led by a seat

export type SeatWarKind = "REVOLUTION" | "JUSTICE";

/** Who may open a war from a seat: the revolution's top two against the Government, the fleet admiral against a Yonko. */
export function seatWarKind(seat: SeatId | null | undefined): SeatWarKind | null {
  if (seat === "REV_LEADER" || seat === "REV_CHIEF") return "REVOLUTION";
  if (seat === "FLEET_ADMIRAL") return "JUSTICE";
  return null;
}

export function isRevolutionBase(factionControl: string | null | undefined): boolean {
  return /revolucionari/i.test(factionControl ?? "");
}

export function seatWarBlockReason(p: { kind: SeatWarKind; seat: SeatId | null; hasOpenWar: boolean; lastWarEndedAt: Date | null; targetIsEmperor?: boolean; now: Date; cooldownMs: number }): string | null {
  if (seatWarKind(p.seat) !== p.kind) return p.kind === "REVOLUTION" ? "Solo el Líder o el Jefe de Estado Mayor revolucionario pueden declarar la guerra al Gobierno." : "Solo el Almirante de Flota puede declarar una guerra de justicia.";
  if (p.hasOpenWar) return "Ya hay una guerra abierta: termina esa antes de abrir otro frente.";
  if (p.kind === "JUSTICE" && !p.targetIsEmperor) return "La guerra de justicia solo se declara contra un Yonko.";
  if (p.lastWarEndedAt && p.now.getTime() - p.lastWarEndedAt.getTime() < p.cooldownMs) return "Tus fuerzas aún se recuperan de la última guerra.";
  return null;
}
