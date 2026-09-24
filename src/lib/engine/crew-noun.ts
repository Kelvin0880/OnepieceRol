/** What a "crew" is called narratively depends on the faction that formed it. */
const CREW_NOUN: Record<"PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER" | "CP0", string> = {
  PIRATE: "Tripulación",
  MARINE: "Escuadrón",
  REVOLUTIONARY: "Célula",
  BOUNTY_HUNTER: "Gremio",
  CP0: "Unidad",
};

export function crewNounForFaction(faction: keyof typeof CREW_NOUN): string {
  return CREW_NOUN[faction];
}

/** Bounty hunters always work alone: they have a guild noun for flavor, but never a crew of players. */
export function factionCanHaveCrew(faction: string): boolean {
  return faction !== "BOUNTY_HUNTER";
}

export const SOLO_FACTION_REASON = "Los cazarrecompensas trabajan siempre en solitario: no forman tripulación ni se unen a ninguna.";
