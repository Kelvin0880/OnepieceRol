import { ISLAND_NPC_DATA } from "./island-npc-data";
import { ISLAND_NPC_DATA_WAVE2 } from "./island-npc-data-wave2";
import { SPECIAL_RECRUITS } from "./special-recruit-data";
import type { SeedRosterEntry } from "./island-npcs";

/** Every resident the seed writes: ordinary rosters plus the special recruits. One list so no seeding path forgets a wave. */
export const ALL_RESIDENTS: SeedRosterEntry[] = [...ISLAND_NPC_DATA, ...ISLAND_NPC_DATA_WAVE2, ...SPECIAL_RECRUITS];
