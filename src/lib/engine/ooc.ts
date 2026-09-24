/**
 * Pure rules for the out-of-role toolbox (game/ooc.ts): character renaming,
 * restore-point snapshots and rollback eligibility, and "unstick" repairs.
 * Nothing here touches the DB — the game layer feeds it plain numbers.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 30;
export const MAX_ROLLBACKS_PER_DAY = 3;
export const MAX_AUTO_CHECKPOINTS = 8;
/** Auto checkpoints are throttled so a busy scene doesn't flood the list. */
export const AUTO_CHECKPOINT_MIN_GAP_MS = 10 * 60 * 1000;

export const NARRATOR_TONES = ["balanced", "lethal", "story"] as const;
export type NarratorTone = (typeof NARRATOR_TONES)[number];

export function isNarratorTone(v: unknown): v is NarratorTone {
  return typeof v === "string" && (NARRATOR_TONES as readonly string[]).includes(v);
}

export function validateCharacterName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < NAME_MIN) return { ok: false, reason: `El nombre debe tener al menos ${NAME_MIN} letras.` };
  if (name.length > NAME_MAX) return { ok: false, reason: `El nombre no puede pasar de ${NAME_MAX} caracteres.` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .'\-]*$/u.test(name)) return { ok: false, reason: "El nombre solo admite letras, números, espacios, puntos, apóstrofes y guiones." };
  return { ok: true, name };
}

export interface CharacterSnapshot {
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  berries: number;
  bounty: number;
  notoriety: number;
  strength: number;
  agility: number;
  durability: number;
  willpower: number;
  intellect: number;
  observationHaki: number;
  armamentHaki: number;
  currentIslandId: string;
  /** What the narrator remembered at that moment (null = nothing). A rollback restores it so the discarded timeline is forgotten. Absent on very old snapshots: then memory is cleared. */
  memorySummary?: string | null;
  sceneCompactedUntil?: string | null;
  missions?: { id: string; progress: number; status: string }[];
  companions?: { id: string; hp: number; status: string }[];
  /** Gear signature: if it changed since the snapshot, berries are NOT rolled back (no buy-then-rollback refunds). */
  gearSignature: string;
}

export function gearSignature(parts: { weaponId?: string | null; fruitId?: string | null; inventoryCount: number }): string {
  return `${parts.weaponId ?? "-"}|${parts.fruitId ?? "-"}|${parts.inventoryCount}`;
}

export interface RollbackContext {
  dead: boolean;
  imprisoned: boolean;
  inDuelOrJointFight: boolean;
  rollbacksLast24h: number;
}

export function canRollback(ctx: RollbackContext): { ok: true } | { ok: false; reason: string } {
  if (ctx.dead) return { ok: false, reason: "Un personaje muerto no puede volver atrás: la muerte permanente es la regla central del juego." };
  if (ctx.imprisoned) return { ok: false, reason: "No puedes deshacer una captura con un rollback. Usa fianza, rescate o fuga." };
  if (ctx.inDuelOrJointFight) return { ok: false, reason: "No puedes hacer rollback en mitad de un duelo o pelea en grupo: afectaría a otros jugadores." };
  if (ctx.rollbacksLast24h >= MAX_ROLLBACKS_PER_DAY) return { ok: false, reason: `Ya usaste ${MAX_ROLLBACKS_PER_DAY} rollbacks en las últimas 24 horas.` };
  return { ok: true };
}

/** What a rollback writes back. Berries are only restored when the gear is unchanged. */
export function planRollback(snap: CharacterSnapshot, currentGearSignature: string, currentBerries: number) {
  const berriesRestored = snap.gearSignature === currentGearSignature;
  return {
    data: {
      level: snap.level,
      experience: snap.experience,
      hp: Math.min(snap.hp, snap.maxHp),
      maxHp: snap.maxHp,
      stamina: Math.min(snap.stamina, snap.maxStamina),
      maxStamina: snap.maxStamina,
      bounty: snap.bounty,
      notoriety: snap.notoriety,
      strength: snap.strength,
      agility: snap.agility,
      durability: snap.durability,
      willpower: snap.willpower,
      intellect: snap.intellect,
      observationHaki: snap.observationHaki,
      armamentHaki: snap.armamentHaki,
      currentIslandId: snap.currentIslandId,
      berries: berriesRestored ? snap.berries : currentBerries,
    },
    berriesRestored,
  };
}

export interface RepairInput {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  berries: number;
  bounty: number;
  notoriety: number;
  experience: number;
}

/** Clamps impossible values back into range; returns only what actually changed. */
export function planRepair(c: RepairInput): { changes: Record<string, number>; notes: string[] } {
  const changes: Record<string, number> = {};
  const notes: string[] = [];
  const fix = (key: keyof RepairInput, value: number, note: string) => {
    if (c[key] !== value) {
      changes[key] = value;
      notes.push(note);
    }
  };
  const maxHp = Math.max(1, c.maxHp);
  const maxSt = Math.max(1, c.maxStamina);
  fix("maxHp", maxHp, "vida máxima inválida");
  fix("hp", Math.min(Math.max(1, c.hp), maxHp), "vida fuera de rango");
  fix("maxStamina", maxSt, "aguante máximo inválido");
  fix("stamina", Math.min(Math.max(0, c.stamina), maxSt), "aguante fuera de rango");
  fix("berries", Math.max(0, c.berries), "berries negativos");
  fix("bounty", Math.max(0, c.bounty), "recompensa negativa");
  fix("notoriety", Math.max(0, c.notoriety), "notoriedad negativa");
  fix("experience", Math.max(0, c.experience), "experiencia negativa");
  return { changes, notes };
}

export function checkpointLabel(kind: "auto" | "manual", reason: string): string {
  return kind === "manual" ? reason.slice(0, 60) : `Auto: ${reason}`.slice(0, 60);
}

export interface SnapshotDiffLine {
  label: string;
  from: string | number;
  to: string | number;
}

/** What a rollback will visibly change, for the warning shown before the player confirms. Only fields that differ. */
export function diffSnapshot(snap: CharacterSnapshot, current: CharacterSnapshot & { berries: number }, islandNames: { snapshot: string; current: string }, berriesRestored: boolean): SnapshotDiffLine[] {
  const lines: SnapshotDiffLine[] = [];
  const add = (label: string, from: string | number, to: string | number) => {
    if (from !== to) lines.push({ label, from, to });
  };
  add("Nivel", current.level, snap.level);
  add("Experiencia", current.experience, snap.experience);
  add("Vida", current.hp, Math.min(snap.hp, snap.maxHp));
  add("Aguante", current.stamina, Math.min(snap.stamina, snap.maxStamina));
  if (berriesRestored) add("Berries", current.berries, snap.berries);
  add("Recompensa", current.bounty, snap.bounty);
  add("Fuerza", current.strength, snap.strength);
  add("Agilidad", current.agility, snap.agility);
  add("Resistencia", current.durability, snap.durability);
  add("Voluntad", current.willpower, snap.willpower);
  add("Intelecto", current.intellect, snap.intellect);
  add("Haki de Armadura", current.armamentHaki, snap.armamentHaki);
  add("Haki de Observación", current.observationHaki, snap.observationHaki);
  add("Isla", islandNames.current, islandNames.snapshot);
  return lines;
}
