import { actorCombatStats } from "./guardian";

/**
 * The final raid: a coalition storms Mary Geoise through four joint fights to
 * topple the hidden ruler. Pure rules here — requirements, the four phases,
 * NPC allies earned through standing, cooldowns.
 */

export const RAID_PHASES = 4;
export const MAX_RAID_PARTICIPANTS = 20;
export const MAX_ALLIES = 4;
export const PLEDGE_MIN_STANDING = 60;
export const RAID_COOLDOWN_MS = 7 * 24 * 3600_000;
export const RAID_LOSS_COOLDOWN_MS = 24 * 3600_000;
export const RAID_IDLE_EXPIRY_MS = 6 * 3600_000;
export const RAID_VOTE_WINDOW_MS = 24 * 3600_000;
export const RAID_MAX_ENEMY_ATTACKS = 6;
export const MAX_STANDING = 100;

export const PHASE_NAMES = ["La Guardia de Pangea", "Los Cinco Ancianos", "Los Almirantes de la Marina", "El Rey Sin Nombre"];

/** The force met in each phase, from a holder power level; group scaling is added by the joint fight itself. */
export function phaseEnemy(phase: number) {
  const p = Math.max(1, Math.min(RAID_PHASES, phase));
  const power = [82, 97, 95, 100][p - 1];
  const s = actorCombatStats(power);
  const hpK = [1, 1.1, 1.2, 1.6][p - 1];
  return { name: PHASE_NAMES[p - 1], hp: Math.round(s.hp * hpK), atk: s.atk, def: s.def, spd: s.spd, maxEnemyAttacks: RAID_MAX_ENEMY_ATTACKS };
}

export function phaseRewards(phase: number) {
  const p = Math.max(1, Math.min(RAID_PHASES, phase));
  return { berries: 200_000 * p, xp: 300 * p, bounty: 30_000_000 * p, islandDanger: 10 };
}

export interface RaidJoinCheck {
  knowsTruth: boolean;
  onIsland: boolean;
  alreadyMustered: boolean;
  musterSize: number;
}

/** Only someone who has seen Laugh Tale and stands in Mary Geoise can join, within the participant cap. */
export function joinBlockReason(c: RaidJoinCheck): string | null {
  if (!c.knowsTruth) return "Solo quien ha llegado a Laugh Tale y sabe la verdad sobre el One Piece puede unirse a esta empresa.";
  if (!c.onIsland) return "Tienes que estar en Mary Geoise para unirte al asalto.";
  if (c.alreadyMustered) return "Ya formas parte de la coalición.";
  if (c.musterSize >= MAX_RAID_PARTICIPANTS) return "La coalición ya está completa.";
  return null;
}

export function raidCooldownLeftMs(lastResolvedAt: Date | null, lastStatus: string | null, now: Date): number {
  if (!lastResolvedAt) return 0;
  const wait = lastStatus === "WON" ? RAID_COOLDOWN_MS : lastStatus === "LOST" ? RAID_LOSS_COOLDOWN_MS : 0;
  return Math.max(0, lastResolvedAt.getTime() + wait - now.getTime());
}

export function standingAfterMission(standing: number, difficultyTier: number): number {
  return Math.min(MAX_STANDING, standing + 8 + 4 * Math.max(0, Math.min(3, difficultyTier)));
}

export function standingAfterMercy(standing: number): number {
  return Math.min(MAX_STANDING, standing + 10);
}

export function canPledge(standing: number, pledgedSoFar: number): { ok: boolean; reason?: string } {
  if (standing < PLEDGE_MIN_STANDING) return { ok: false, reason: `Aún no confía lo bastante en ti (${standing}/${PLEDGE_MIN_STANDING}). Cumple misiones en su nombre o perdona a su gente.` };
  if (pledgedSoFar >= MAX_ALLIES) return { ok: false, reason: `La coalición ya cuenta con ${MAX_ALLIES} aliados de renombre.` };
  return { ok: true };
}

/** An ally fights as a strong but not decisive force: a fraction of their full power, so players remain the story. */
export function allyStats(powerLevel: number) {
  const s = actorCombatStats(powerLevel);
  return { hp: Math.round(s.hp * 0.6), atk: Math.round(s.atk * 0.55), def: Math.round(s.def * 0.55), spd: Math.round(s.spd * 0.7) };
}

export function raidExpired(lastActivityMs: number, nowMs: number): boolean {
  return nowMs - lastActivityMs > RAID_IDLE_EXPIRY_MS;
}
