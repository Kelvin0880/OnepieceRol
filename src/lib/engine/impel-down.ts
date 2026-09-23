/**
 * Impel Down: the Government's underwater prison for the truly dangerous.
 * Anyone below the bounty/notoriety bar is held in an ordinary brig (see
 * prison.ts); above it they are sent down to one of six levels, deeper the
 * more wanted they are. There is no bail, and getting someone out means
 * reaching the island itself (very high level requirement) and beating a
 * guard strength that grows with the depth.
 */
// Character.bounty is a 32-bit column (max ~2.147B), so the deepest cell has to sit below that ceiling to be reachable at all.
export const MAX_PLAYER_BOUNTY = 2_100_000_000;
const PIRATE_BOUNTY_CELLS = [100_000_000, 300_000_000, 600_000_000, 1_000_000_000, 1_500_000_000, 2_000_000_000];
const NOTORIETY_CELLS = [700, 1_300, 2_400, 4_200, 7_000, 12_000];

function cellFor(value: number, thresholds: number[]): number {
  let cell = 0;
  thresholds.forEach((t, i) => {
    if (value >= t) cell = i + 1;
  });
  return cell;
}

/** 0 = not Impel Down material (ordinary brig); 1-6 = cell level. Marines and Cipher Pol are never sent there. */
export function impelDownCell(faction: string, bounty: number, notoriety: number): number {
  if (faction === "PIRATE") return cellFor(bounty, PIRATE_BOUNTY_CELLS);
  if (faction === "REVOLUTIONARY" || faction === "BOUNTY_HUNTER") return cellFor(notoriety, NOTORIETY_CELLS);
  return 0;
}

export const IMPEL_DOWN_MIN_LEVEL = 45;

export const CELL_LABELS: Record<number, string> = {
  1: "Nivel 1 — Infierno Carmesí",
  2: "Nivel 2 — Infierno de las Bestias",
  3: "Nivel 3 — Infierno de Hambre",
  4: "Nivel 4 — Infierno de Fuego Abrasador",
  5: "Nivel 5 — Infierno de Hielo",
  6: "Nivel 6 — Nivel Eterno",
};

/** Guard strength the rescuer must beat: the captor's power, scaled up per level, plus a flat wall per level. */
export function impelDownRescueLevel(captorPower: number, cell: number): number {
  return Math.round(captorPower * (1 + 0.3 * cell)) + cell * 15;
}

/** A failed (not catastrophic) rescue at Impel Down still costs the rescuer this fraction of their max HP. */
export const IMPEL_FAILED_RESCUE_HP_FRACTION = 0.4;
