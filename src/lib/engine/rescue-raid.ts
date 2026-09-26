/**
 * Rescue raid: adventurers storm Impel Down to free a captured canon character. The deeper the cell, the higher the level
 * and the bigger the group needed, and the stronger the guard that stands in the way. Pure rules only.
 */
export interface RescueRequirement {
  minLevel: number;
  minPeople: number;
  guardPower: number;
}

/** Impel Down itself already asks for level 45; each level below the surface asks a little more of everyone. */
export function rescueRequirement(cell: number): RescueRequirement {
  const c = Math.max(1, Math.min(6, Math.round(cell)));
  return { minLevel: 45 + (c - 1) * 2, minPeople: c <= 2 ? 1 : c <= 4 ? 2 : 3, guardPower: 76 + c * 3 };
}

export function rescueBlockReason(p: { cell: number; levels: number[] }): string | null {
  const r = rescueRequirement(p.cell);
  if (p.levels.length < r.minPeople) return `Para llegar a este nivel hacen falta al menos ${r.minPeople} personas en el asalto (ahora sois ${p.levels.length}).`;
  const low = p.levels.filter((l) => l < r.minLevel).length;
  if (low > 0) return `Todos los asaltantes necesitan nivel ${r.minLevel} o más para este nivel de la prisión.`;
  return null;
}

export function rescueRewards(cell: number, guardPower: number) {
  return { berries: guardPower * 300 + cell * 5000, xp: guardPower * 5 + cell * 60, bounty: guardPower * 30_000, islandDanger: 10 };
}
