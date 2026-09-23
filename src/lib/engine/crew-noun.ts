/** What a "crew" is called narratively depends on the faction that formed it. */
const CREW_NOUN: Record<"PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER", string> = {
  PIRATE: "Tripulación",
  MARINE: "Escuadrón",
  REVOLUTIONARY: "Célula",
  BOUNTY_HUNTER: "Gremio",
};

export function crewNounForFaction(faction: keyof typeof CREW_NOUN): string {
  return CREW_NOUN[faction];
}
