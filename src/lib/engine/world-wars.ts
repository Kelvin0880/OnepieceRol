import type { FactionKey } from "./progression";
import { pickBySeed } from "./faction-seats";

/**
 * Wars the canon powers start on their own: the Revolution against the World Government, the Fleet Admiral against an
 * Emperor, an Emperor against the Marines or against another Emperor. They run like a player's war (three decisive
 * blows in seven days) but the world also fights its own fronts every few hours, judged, and players join a side.
 * Nobody dies in them: they move islands, titles of control and reputations.
 */

export type CanonWarKind = "REVOLUTION" | "JUSTICE" | "EMPEROR" | "MARINE";

export const CANON_WAR_GAP_MS = 4 * 24 * 3600_000;
export const FRONT_INTERVAL_MS = 12 * 3600_000;

export interface WarActor {
  id: string;
  name: string;
  role: string;
  factionType: string;
  seat: string | null;
  powerLevel: number;
  status: string;
}

export interface CanonWarPlan {
  kind: CanonWarKind;
  attacker: WarActor;
  /** null = the World Government / the Marines as a whole. */
  defender: WarActor | null;
  defenderName: string;
}

const active = (a: WarActor) => a.status === "ACTIVE";

/** Every war the world could start right now, from who holds power. */
export function canonWarCandidates(actors: WarActor[]): CanonWarPlan[] {
  const live = actors.filter(active);
  const yonko = live.filter((a) => a.role === "YONKO").sort((a, b) => b.powerLevel - a.powerLevel);
  const revLeader = live.find((a) => a.seat === "REV_LEADER") ?? live.find((a) => a.seat === "REV_CHIEF");
  const fleet = live.find((a) => a.seat === "FLEET_ADMIRAL");
  const out: CanonWarPlan[] = [];
  if (revLeader) out.push({ kind: "REVOLUTION", attacker: revLeader, defender: null, defenderName: "el Gobierno Mundial" });
  if (fleet) for (const y of yonko) out.push({ kind: "JUSTICE", attacker: fleet, defender: y, defenderName: y.name });
  for (const y of yonko) out.push({ kind: "MARINE", attacker: y, defender: null, defenderName: "la Marina" });
  for (let i = 0; i < yonko.length; i++) for (let j = 0; j < yonko.length; j++) if (i !== j) out.push({ kind: "EMPEROR", attacker: yonko[i], defender: yonko[j], defenderName: yonko[j].name });
  return out;
}

/** The Revolution's and the Fleet Admiral's wars come up more often than a random Emperor quarrel. */
export function pickCanonWar(candidates: CanonWarPlan[], busyIds: Set<string>, seed: string): CanonWarPlan | null {
  const free = candidates.filter((c) => !busyIds.has(c.attacker.id) && !(c.defender && busyIds.has(c.defender.id)));
  if (!free.length) return null;
  const weighted = free.flatMap((c) => (c.kind === "REVOLUTION" || c.kind === "JUSTICE" ? [c, c, c] : [c]));
  return pickBySeed(weighted, seed);
}

export type WarSide = "attacker" | "defender";

/**
 * Which side a player fights on without asking: the Government's people always defend it, the Revolution always attacks
 * it, and the Marines always carry a war of justice. Pirates choose (enlist) in the wars between pirates and the Marines.
 */
export function automaticSide(kind: CanonWarKind, faction: FactionKey): WarSide | null {
  const gov = faction === "MARINE" || faction === "CP0";
  if (kind === "REVOLUTION") return faction === "REVOLUTIONARY" ? "attacker" : gov ? "defender" : null;
  if (kind === "JUSTICE") return gov ? "attacker" : null;
  if (kind === "MARINE") return gov ? "defender" : null;
  return null;
}

/** Sides a player may freely enlist on (pirates choosing their Emperor; revolutionaries helping anyone against the Marines). */
export function enlistableSides(kind: CanonWarKind, faction: FactionKey): WarSide[] {
  if (automaticSide(kind, faction)) return [];
  if (faction === "PIRATE") return kind === "EMPEROR" ? ["attacker", "defender"] : kind === "MARINE" ? ["attacker"] : kind === "JUSTICE" ? ["defender"] : [];
  if (faction === "BOUNTY_HUNTER") return kind === "JUSTICE" || kind === "MARINE" ? ["attacker", "defender"] : [];
  return [];
}

export function frontDue(nextFrontAt: Date | null, now: Date): boolean {
  return !nextFrontAt || nextFrontAt <= now;
}

/** A side's champion in a front: its strength plus a little weight for the players who fought on it this week. */
export function frontPower(basePower: number, playerBlowsForSide: number): number {
  return Math.min(100, basePower + 2 * Math.min(5, playerBlowsForSide));
}

export const WAR_KIND_LABEL: Record<CanonWarKind, string> = {
  REVOLUTION: "La Revolución contra el Gobierno Mundial",
  JUSTICE: "Guerra de justicia de la Marina",
  EMPEROR: "Guerra entre Emperadores",
  MARINE: "Un Emperador contra la Marina",
};

export function warDeclarationText(p: CanonWarPlan): { headline: string; body: string } {
  switch (p.kind) {
    case "REVOLUTION":
      return { headline: `¡${p.attacker.name} lanza a la Revolución contra el Gobierno Mundial!`, body: `El Ejército Revolucionario ha declarado la guerra abierta. Los revolucionarios golpearán bases de la Marina y del Gobierno; marines y agentes del CP-0 defenderán cada isla. Tres golpes decisivos, o siete días, decidirán quién gana terreno.` };
    case "JUSTICE":
      return { headline: `${p.attacker.name} declara una guerra de justicia contra ${p.defenderName}`, body: `El Almirante de Flota ha movilizado a la Marina contra el Yonko ${p.defenderName}. Todo marine y agente del CP-0 puede asaltar sus dominios; los piratas pueden alistarse para defenderle.` };
    case "MARINE":
      return { headline: `El Yonko ${p.attacker.name} declara la guerra a la Marina`, body: `${p.attacker.name} ha lanzado su flota contra las bases de la Marina. Los piratas pueden alistarse bajo su bandera; marines y CP-0 defenderán.` };
    case "EMPEROR":
      return { headline: `Guerra entre Emperadores: ${p.attacker.name} contra ${p.defenderName}`, body: `Dos Yonko se disputan el mar. Los piratas pueden alistarse en uno de los dos bandos y asaltar los dominios del otro.` };
  }
}
