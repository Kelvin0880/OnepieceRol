// Meeting a canon character on your island: ask them for a task, or go against them (their vanguard first, then them in person).
import { actorCombatStats } from "./guardian";
import { areHostile, type PlayerFaction } from "./hostility";

export const CANON_CHALLENGE_WINDOW_MS = 24 * 3600_000;
export const CANON_MISSION_COOLDOWN_MS = 6 * 3600_000;
export const VERDICT_CHOICES = ["capture", "death", "spare"] as const;
export type VerdictChoice = (typeof VERDICT_CHOICES)[number];

/** Yonko have their own throne challenge, the Gorosei and the hidden ruler belong to the endgame. */
export const UNCHALLENGEABLE_ROLES = new Set(["YONKO", "GOROSEI", "HIDDEN_RULER"]);

export const isVerdictChoice = (v: unknown): v is VerdictChoice => typeof v === "string" && (VERDICT_CHOICES as readonly string[]).includes(v);

const ACTOR_SIDE: Record<string, PlayerFaction | null> = { MARINE: "MARINE", PIRATE: "PIRATE", REVOLUTIONARY: "REVOLUTIONARY", CIPHER_POL: "CP0", BOUNTY_HUNTER: "BOUNTY_HUNTER", CIVILIAN: null, UNAFFILIATED: null };

export interface CanonActorView {
  id: string;
  name: string;
  role: string;
  powerLevel: number;
  factionType: string;
  status: string;
  locationHidden: boolean;
  currentIslandId: string | null;
}

/** Below this you would only be in the way: a third of their power, at least 10. */
export function canonMinLevel(power: number): number {
  return Math.max(10, Math.round(power / 3));
}

const visibleHere = (a: CanonActorView, islandId: string) => a.status === "ACTIVE" && !a.locationHidden && a.currentIslandId === islandId;

export function missionBlockReason(p: { actor: CanonActorView; playerFaction: PlayerFaction; playerIslandId: string; level: number; hasOpenMission: boolean; lastMissionAt: Date | null; now: Date }): string | null {
  if (!visibleHere(p.actor, p.playerIslandId)) return `${p.actor.name} ya no está a la vista.`;
  const side = ACTOR_SIDE[p.actor.factionType];
  if (side && areHostile(p.playerFaction, side)) return `${p.actor.name} te ve como un enemigo: no te ofrecerá nada.`;
  if (p.hasOpenMission) return "Ya tienes un encargo suyo sin terminar.";
  if (p.lastMissionAt && p.now.getTime() - p.lastMissionAt.getTime() < CANON_MISSION_COOLDOWN_MS) return "Te acaba de encargar algo: dale tiempo para que surja otra cosa.";
  if (p.level < Math.max(3, Math.round(canonMinLevel(p.actor.powerLevel) / 3))) return `Todavía no eres nadie para ${p.actor.name}: sube de nivel.`;
  return null;
}

export function challengeBlockReason(p: { actor: CanonActorView; playerFaction: PlayerFaction; playerIslandId: string; level: number; hasOpenChallenge: boolean; busy: boolean }): string | null {
  if (!visibleHere(p.actor, p.playerIslandId)) return `${p.actor.name} ya no está a la vista.`;
  if (p.actor.role === "NOTABLE_CIVILIAN" || p.actor.factionType === "CIVILIAN") return `${p.actor.name} no es un combatiente: no hay duelo que ganar.`;
  if (UNCHALLENGEABLE_ROLES.has(p.actor.role)) return p.actor.role === "YONKO" ? "A un Yonko solo se le desafía por su trono (panel Poder)." : "Ese personaje pertenece al final del juego: aún no se le puede desafiar.";
  const side = ACTOR_SIDE[p.actor.factionType];
  if (side && side === p.playerFaction && side !== "PIRATE") return `${p.actor.name} es de los tuyos: no te enfrentas a tu propio bando.`;
  if (p.hasOpenChallenge) return "Ya tienes un desafío abierto.";
  if (p.busy) return `${p.actor.name} está ocupado o recuperándose ahora mismo.`;
  const min = canonMinLevel(p.actor.powerLevel);
  if (p.level < min) return `Hace falta nivel ${min} para plantarle cara a ${p.actor.name}.`;
  return null;
}

/** The force in front of the canon character: a strong fraction of their own power, never the real thing. */
export function vanguardOf(actorName: string, power: number) {
  const scaled = Math.round(power * 0.55);
  const s = actorCombatStats(scaled);
  return { name: `Vanguardia de ${actorName}`, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, isBoss: true, level: Math.max(5, Math.round(scaled / 2.6)) };
}

/** The character in person, at full power (the joint fight scales them up for bigger groups). */
export function duelEnemyOf(power: number) {
  const s = actorCombatStats(power);
  return { ...s, level: Math.max(8, Math.round(power / 2.2)) };
}

export const canonRewardMultiplier = (power: number) => 1 + power / 60;

/** What the owner's approval pays the one who brought the canon character down. */
export function verdictReward(power: number, canonBounty: number | null, outcome: "capture" | "death" | "survived"): { berries: number; standing: number } {
  if (outcome === "survived") return { berries: 0, standing: 0 };
  const base = canonBounty ? canonBounty / 40 : power * 200_000;
  const factor = outcome === "capture" ? 1 : 0.5;
  return { berries: Math.round(Math.min(base * factor, 100_000_000)), standing: Math.round(power * (outcome === "capture" ? 3 : 2)) };
}

export function canonBriefFallback(p: { actorName: string; rank: string | null; personality: string | null; targetName: string | null; targetTitle: string | null; islandName: string }): string {
  const voice = p.personality ? ` (${p.personality.replace(/\.$/, "")})` : "";
  return p.targetName
    ? `${p.actorName}${p.rank ? `, ${p.rank},` : ""} te da un encargo en ${p.islandName}${voice}: ${p.targetName}${p.targetTitle ? `, ${p.targetTitle.toLowerCase()},` : ""} se ha vuelto un problema y quiere que se ocupen de él, sin ruido.`
    : `${p.actorName}${p.rank ? `, ${p.rank},` : ""} te pide que recorras ${p.islandName} y le traigas lo que oigas: quiere saber qué se cuece de verdad en la isla${voice}.`;
}

export interface VanguardCandidate {
  id: string;
  name: string;
  powerLevel: number;
  factionName: string;
  status: string;
  currentIslandId: string | null;
  role: string;
  busy: boolean;
}

const crewOf = (factionName: string) => factionName.replace(/\s*\(.*\)\s*$/, "").trim();

/** A canon character is bodyguarded by their own people: the strongest real subordinate below them (same crew/faction), preferring one on this island. Never invented. */
export function pickVanguard(target: { id: string; factionName: string; powerLevel: number; currentIslandId: string | null }, candidates: VanguardCandidate[]): VanguardCandidate | null {
  const crew = crewOf(target.factionName);
  const pool = candidates.filter((c) => c.id !== target.id && c.status === "ACTIVE" && !c.busy && crewOf(c.factionName) === crew && c.powerLevel < target.powerLevel && !UNCHALLENGEABLE_ROLES.has(c.role));
  if (pool.length === 0) return null;
  const here = pool.filter((c) => c.currentIslandId === target.currentIslandId);
  const from = here.length ? here : pool;
  return [...from].sort((a, b) => b.powerLevel - a.powerLevel || a.name.localeCompare(b.name))[0];
}

export const NON_COMBATANT_ROLES = new Set(["NOTABLE_CIVILIAN"]);
