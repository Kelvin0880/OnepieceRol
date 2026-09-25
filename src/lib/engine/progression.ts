/**
 * Every faction climbs a different ladder, but all four read off the same
 * two numbers on Character: `bounty` (pirates) and `notoriety` (the merit/
 * infamy score for everyone else — marine commendations, revolutionary
 * cell influence, bounty-hunter guild standing). Titles are flavor for the
 * UI and the news feed ("¡Nueva recompensa: 42.000.000 - 'Espadachín
 * Demonio'!"); thresholds are canon-paced, not evenly spaced, because the
 * jump from rookie to Yonko-adjacent should feel enormous.
 */

export interface Tier {
  threshold: number;
  title: string;
}

const PIRATE_BOUNTY_TIERS: Tier[] = [
  { threshold: 0, title: "Sin recompensa" },
  { threshold: 1_000_000, title: "Novato de la Grand Line" },
  { threshold: 10_000_000, title: "Pirata de interés" },
  { threshold: 30_000_000, title: "Superrookie" },
  { threshold: 100_000_000, title: "Amenaza reconocida" },
  { threshold: 200_000_000, title: "Objetivo prioritario" },
  { threshold: 500_000_000, title: "Candidato a Shichibukai" },
  { threshold: 1_000_000_000, title: "Rango de Emperador" },
  { threshold: 2_000_000_000, title: "Leyenda viviente" },
  { threshold: 5_000_000_000, title: "Rey Pirata en ciernes" },
];

const MARINE_RANK_TIERS: Tier[] = [
  { threshold: 0, title: "Recluta" },
  { threshold: 50, title: "Marine Raso" },
  { threshold: 150, title: "Cabo" },
  { threshold: 350, title: "Sargento" },
  { threshold: 700, title: "Teniente" },
  { threshold: 1_300, title: "Capitán" },
  { threshold: 2_400, title: "Comodoro" },
  { threshold: 4_200, title: "Contraalmirante" },
  { threshold: 7_000, title: "Vicealmirante" },
  { threshold: 12_000, title: "Almirante" },
  { threshold: 20_000, title: "Almirante de Flota" },
];

const REVOLUTIONARY_TIERS: Tier[] = [
  { threshold: 0, title: "Simpatizante" },
  { threshold: 50, title: "Célula activa" },
  { threshold: 150, title: "Agente de campo" },
  { threshold: 350, title: "Organizador regional" },
  { threshold: 700, title: "Comandante de brigada" },
  { threshold: 1_300, title: "Jefe de ejército" },
  { threshold: 2_400, title: "Mano derecha del líder" },
  { threshold: 4_200, title: "Núcleo revolucionario" },
];

const BOUNTY_HUNTER_TIERS: Tier[] = [
  { threshold: 0, title: "Cazador novato" },
  { threshold: 50, title: "Cazador de gremio" },
  { threshold: 150, title: "Rastreador temido" },
  { threshold: 350, title: "Verdugo independiente" },
  { threshold: 700, title: "Cazador de leyenda" },
  { threshold: 1_300, title: "Rival de la Marina" },
  { threshold: 2_400, title: "Azote de los mares" },
];

export const CP0_TIERS: Tier[] = [
  { threshold: 0, title: "Aspirante" },
  { threshold: 40, title: "Agente CP10" },
  { threshold: 120, title: "Agente CP9" },
  { threshold: 280, title: "Agente CP8" },
  { threshold: 550, title: "Agente CP7" },
  { threshold: 950, title: "Agente CP5" },
  { threshold: 1_500, title: "Agente CP3" },
  { threshold: 2_300, title: "Agente CP1" },
  { threshold: 3_500, title: "Agente CP0" },
  { threshold: 6_000, title: "Caballero Divino" },
  { threshold: 12_000, title: "Gorosei" },
];

export type FactionKey = "PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER" | "CP0";

function tierFor(value: number, tiers: Tier[]): Tier {
  let current = tiers[0];
  for (const tier of tiers) {
    if (value >= tier.threshold) current = tier;
    else break;
  }
  return current;
}

/** Below the first official poster (1,000,000) a pirate with some bounty is not "without bounty": the World Government just has not printed a poster yet. */
export const UNPOSTED_TITLE = "Aún sin cartel oficial";

export function pirateBountyTitle(bounty: number): string {
  if (bounty > 0 && bounty < PIRATE_BOUNTY_TIERS[1].threshold) return UNPOSTED_TITLE;
  return tierFor(bounty, PIRATE_BOUNTY_TIERS).title;
}

export function marineRankTitle(meritPoints: number): string {
  return tierFor(meritPoints, MARINE_RANK_TIERS).title;
}

export function revolutionaryTitle(notoriety: number): string {
  return tierFor(notoriety, REVOLUTIONARY_TIERS).title;
}

export function bountyHunterTitle(notoriety: number): string {
  return tierFor(notoriety, BOUNTY_HUNTER_TIERS).title;
}

export function cp0Title(notoriety: number): string {
  return tierFor(notoriety, CP0_TIERS).title;
}

export function factionTitle(
  faction: FactionKey,
  bounty: number,
  notoriety: number
): string {
  switch (faction) {
    case "PIRATE":
      return pirateBountyTitle(bounty);
    case "MARINE":
      return marineRankTitle(notoriety);
    case "REVOLUTIONARY":
      return revolutionaryTitle(notoriety);
    case "BOUNTY_HUNTER":
      return bountyHunterTitle(notoriety);
    case "CP0":
      return cp0Title(notoriety);
  }
}

/**
 * Whether a headline-worthy milestone was just crossed (used to decide if
 * a NewsItem should be posted — climbing from 999,998 to 1,000,050 berries
 * of bounty is a big deal; 999,998 to 999,999 is not).
 */
export function crossedTier(before: number, after: number, tiers: Tier[]): Tier | null {
  for (const tier of tiers) {
    if (before < tier.threshold && after >= tier.threshold) return tier;
  }
  return null;
}

export function crossedPirateTier(before: number, after: number): Tier | null {
  return crossedTier(before, after, PIRATE_BOUNTY_TIERS);
}

export function crossedMarineTier(before: number, after: number): Tier | null {
  return crossedTier(before, after, MARINE_RANK_TIERS);
}

export interface RankProgress {
  /** What the number measures, for the label ("Recompensa", "Mérito"...). */
  metric: string;
  title: string;
  nextTitle: string | null;
  value: number;
  /** Threshold of the current tier and of the next one (null at the top). */
  floor: number;
  target: number | null;
  /** 0..1 progress inside the current tier (1 at the top). */
  fraction: number;
  remaining: number | null;
}

function tiersFor(faction: FactionKey): Tier[] {
  switch (faction) {
    case "PIRATE": return PIRATE_BOUNTY_TIERS;
    case "MARINE": return MARINE_RANK_TIERS;
    case "REVOLUTIONARY": return REVOLUTIONARY_TIERS;
    case "BOUNTY_HUNTER": return BOUNTY_HUNTER_TIERS;
    case "CP0": return CP0_TIERS;
  }
}

const METRIC: Record<FactionKey, string> = { PIRATE: "Recompensa", MARINE: "Mérito", REVOLUTIONARY: "Influencia", BOUNTY_HUNTER: "Reputación de gremio", CP0: "Confianza del Gobierno" };

/** How far you are inside your current rank and what is left for the next one — the same numbers that trigger the promotion news. */
export function rankProgress(faction: FactionKey, bounty: number, notoriety: number): RankProgress {
  const tiers = tiersFor(faction);
  const value = faction === "PIRATE" ? bounty : notoriety;
  const idx = tiers.reduce((best, t, i) => (value >= t.threshold ? i : best), 0);
  const next = tiers[idx + 1] ?? null;
  const floor = tiers[idx].threshold;
  const title = factionTitle(faction, bounty, notoriety);
  if (!next) return { metric: METRIC[faction], title, nextTitle: null, value, floor, target: null, fraction: 1, remaining: null };
  return {
    metric: METRIC[faction],
    title,
    nextTitle: next.title,
    value,
    floor,
    target: next.threshold,
    fraction: Math.max(0, Math.min(1, (value - floor) / (next.threshold - floor))),
    remaining: Math.max(0, next.threshold - value),
  };
}
