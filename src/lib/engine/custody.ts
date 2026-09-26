/**
 * A player who captures another player (and is not the Government) has to CARRY the prisoner to a Government island to
 * hand them over and collect the reward. Until then the captive travels with the captor, cannot act, and can be freed
 * by allies. Pure rules only.
 */
export const CUSTODY_MAX_MS = 24 * 60 * 60 * 1000;

const GOVERNMENT_NAMES = ["Loguetown", "Cuartel Marine G-5", "G-8 Navarone", "Marineford", "Nuevo Marineford", "Enies Lobby", "Impel Down", "Mary Geoise", "Archipiélago Sabaody", "Tequila Wolf"];

/** Marine bases, Cipher Pol posts and the World Government's own islands. */
export function isGovernmentIsland(name: string, factionControl: string | null): boolean {
  if (GOVERNMENT_NAMES.includes(name)) return true;
  return /marina|gobierno mundial/i.test(factionControl ?? "");
}

export function custodyExpired(capturedAt: Date, now: Date): boolean {
  return now.getTime() - capturedAt.getTime() >= CUSTODY_MAX_MS;
}

/** What the captor is told about the trip. */
export function custodyHint(onGovernmentIsland: boolean, islandNames: string[]): string {
  return onGovernmentIsland
    ? "Estás en una isla del Gobierno: puedes entregarlo ahora y cobrar la recompensa."
    : `Llévalo a una isla del Gobierno para entregarlo (${islandNames.slice(0, 6).join(", ")}...). Viaja contigo; si tardas más de 24 horas, se te escapa.`;
}
