import { describe, it, expect } from "vitest";
import {
  buildExploreNarrationPrompt,
  buildCombatNarrationPrompt,
  buildMemoryUpdatePrompt,
  buildSceneNarrationPrompt,
  buildPartySceneNarrationPrompt,
  ExploreNarrationInput,
  CombatNarrationInput,
  SceneNarrationInput,
  PartySceneNarrationInput,
} from "./narrate-prompt";

const exploreBase: ExploreNarrationInput = {
  characterName: "Kaze",
  faction: "PIRATE",
  level: 5,
  islandName: "Pueblo Foosha",
  islandDescription: "Un pueblo costero tranquilo.",
  outcomeTier: "success",
  baseFlavorText: "Sigues un rumor local.",
  baseNarrative: "Encuentras un atajo útil.",
  berries: 150,
  xp: 10,
  bounty: 0,
  hpLoss: 0,
};

describe("buildExploreNarrationPrompt", () => {
  it("instructs the model never to alter or invent the outcome", () => {
    const { system } = buildExploreNarrationPrompt(exploreBase);
    expect(system).toMatch(/ya están decididos y son definitivos/);
    expect(system).toMatch(/NUNCA cambies, inventes/);
  });

  it("includes every resolved numeric value in the user prompt", () => {
    const { user } = buildExploreNarrationPrompt(exploreBase);
    expect(user).toContain("150");
    expect(user).toContain("+10");
    expect(user).toContain(exploreBase.outcomeTier);
  });

  it("includes the player's free-text intent when provided", () => {
    const { user } = buildExploreNarrationPrompt({ ...exploreBase, intentText: "Camino con cautela por la niebla." });
    expect(user).toContain("Camino con cautela por la niebla.");
  });

  it("omits the intent block entirely when no intent is given", () => {
    const { user } = buildExploreNarrationPrompt(exploreBase);
    expect(user).not.toContain("El jugador describió su acción así");
  });

  it("includes recent memory lines when provided", () => {
    const { user } = buildExploreNarrationPrompt({ ...exploreBase, recentMemory: ["Derrotó a Arlong ayer.", "Perdió su primer duelo."] });
    expect(user).toContain("Derrotó a Arlong ayer.");
    expect(user).toContain("Perdió su primer duelo.");
  });

  it("never asks for JSON or markdown structure", () => {
    const { system } = buildExploreNarrationPrompt(exploreBase);
    expect(system).toMatch(/sin JSON/);
  });

  it("includes the persistent memory summary when provided, distinct from recent raw lines", () => {
    const { user } = buildExploreNarrationPrompt({ ...exploreBase, memorySummary: "Es un pirata conocido por perdonar rivales." });
    expect(user).toContain("Es un pirata conocido por perdonar rivales.");
  });
});

const combatBase: CombatNarrationInput = {
  characterName: "Kaze",
  enemyName: "Bandido",
  isBoss: false,
  rounds: [
    { attacker: "Kaze", defender: "Bandido", damage: 12 },
    { attacker: "Bandido", defender: "Kaze", damage: 0 },
  ],
  concluded: true,
  victor: "player",
  playerHpLeft: 38,
  playerMaxHp: 50,
  enemyHpLeft: 0,
  enemyMaxHp: 40,
};

describe("buildCombatNarrationPrompt", () => {
  it("instructs the model never to alter or invent the outcome", () => {
    const { system } = buildCombatNarrationPrompt(combatBase);
    expect(system).toMatch(/NUNCA cambies, inventes/);
  });

  it("includes the final victor and remaining HP when the fight concluded", () => {
    const { user } = buildCombatNarrationPrompt(combatBase);
    expect(user).toContain("gana Kaze");
    expect(user).toContain("38/50");
  });

  it("only lists rounds with actual damage", () => {
    const { user } = buildCombatNarrationPrompt(combatBase);
    expect(user).toContain("Kaze golpea a Bandido (12 de daño)");
    expect(user).not.toContain("Bandido golpea a Kaze (0 de daño)");
  });

  it("includes enemy personality when present", () => {
    const { user } = buildCombatNarrationPrompt({ ...combatBase, enemyPersonality: "arrogante y cruel" });
    expect(user).toContain("arrogante y cruel");
  });

  it("marks boss fights as more intense in the system prompt", () => {
    const boss = buildCombatNarrationPrompt({ ...combatBase, isBoss: true });
    const minor = buildCombatNarrationPrompt({ ...combatBase, isBoss: false });
    expect(boss.system).not.toBe(minor.system);
  });

  it("asks for an extensive scene with dialogue, not a short blurb", () => {
    const { system } = buildCombatNarrationPrompt(combatBase);
    expect(system).toMatch(/extensa/i);
    expect(system).toMatch(/diálogo/);
  });

  it("includes the persistent memory summary when provided", () => {
    const { user } = buildCombatNarrationPrompt({ ...combatBase, memorySummary: "Ya se enfrentó a este bandido una vez y perdió su espada." });
    expect(user).toContain("Ya se enfrentó a este bandido una vez y perdió su espada.");
  });

  it("does not claim a final victor while the fight is still ongoing", () => {
    const ongoing: CombatNarrationInput = { ...combatBase, concluded: false, victor: undefined, enemyHpLeft: 28 };
    const { user } = buildCombatNarrationPrompt(ongoing);
    expect(user).not.toContain("gana Kaze");
    expect(user).toMatch(/sigue/);
  });

  it("invites the player's next move instead of deciding how the fight continues", () => {
    const ongoing: CombatNarrationInput = { ...combatBase, concluded: false, victor: undefined, enemyHpLeft: 28 };
    const { user } = buildCombatNarrationPrompt(ongoing);
    expect(user).toMatch(/siguiente movimiento/);
  });
});

const sceneBase: SceneNarrationInput = {
  characterName: "Kaze",
  faction: "PIRATE",
  level: 5,
  islandName: "Pueblo Foosha",
  islandDescription: "Un pueblo costero tranquilo.",
  playerText: "Entro al bar y me fijo si alguien interesante anda por ahí.",
};

describe("buildSceneNarrationPrompt", () => {
  it("forbids granting or altering any mechanical outcome", () => {
    const { system } = buildSceneNarrationPrompt(sceneBase);
    expect(system).toMatch(/SIN tiradas de dados ni resultados mecánicos/);
    expect(system).toMatch(/Nunca otorgues ni quites berries/);
  });

  it("includes the player's free text verbatim", () => {
    const { user } = buildSceneNarrationPrompt(sceneBase);
    expect(user).toContain("Entro al bar y me fijo si alguien interesante anda por ahí.");
  });

  it("includes prior scene transcript lines when provided", () => {
    const { user } = buildSceneNarrationPrompt({ ...sceneBase, recentScene: ["[Jugador]: Miro alrededor.", "El bar está lleno de piratas ruidosos."] });
    expect(user).toContain("El bar está lleno de piratas ruidosos.");
  });

  it("includes the persistent memory summary when provided", () => {
    const { user } = buildSceneNarrationPrompt({ ...sceneBase, memorySummary: "Es conocido por su generosidad con extraños." });
    expect(user).toContain("Es conocido por su generosidad con extraños.");
  });
});

const partySceneBase: PartySceneNarrationInput = {
  islandName: "Pueblo Foosha",
  islandDescription: "Un pueblo costero tranquilo.",
  partyRoster: [
    { name: "Kaze", faction: "PIRATE", level: 5 },
    { name: "Mira", faction: "PIRATE", level: 4 },
  ],
  actingCharacterName: "Kaze",
  playerText: "Entro al bar mirando si alguien nos reconoce.",
};

describe("buildPartySceneNarrationPrompt", () => {
  it("forbids granting or altering any mechanical outcome, same as the solo scene prompt", () => {
    const { system } = buildPartySceneNarrationPrompt(partySceneBase);
    expect(system).toMatch(/SIN tiradas de dados ni resultados mecánicos/);
    expect(system).toMatch(/Nunca otorgues ni quites berries/);
  });

  it("lists every present party member by name, not just whoever is acting", () => {
    const { user } = buildPartySceneNarrationPrompt(partySceneBase);
    expect(user).toContain("Kaze");
    expect(user).toContain("Mira");
  });

  it("instructs the narrator it may address anyone in the group, not only the acting character", () => {
    const { system } = buildPartySceneNarrationPrompt(partySceneBase);
    expect(system).toMatch(/CUALQUIERA de los personajes presentes/);
  });

  it("includes the acting character's free text verbatim", () => {
    const { user } = buildPartySceneNarrationPrompt(partySceneBase);
    expect(user).toContain("Entro al bar mirando si alguien nos reconoce.");
  });

  it("includes recent party transcript lines when provided", () => {
    const { user } = buildPartySceneNarrationPrompt({ ...partySceneBase, recentParty: ["Mira: Pido una ronda para todos.", "Narrador: El tabernero asiente."] });
    expect(user).toContain("El tabernero asiente.");
  });
});

describe("buildMemoryUpdatePrompt", () => {
  it("asks for JSON with a bounded summary and never inventing facts", () => {
    const { system } = buildMemoryUpdatePrompt(undefined, "Derrotó a Arlong y lo perdonó.");
    expect(system).toMatch(/JSON/);
    expect(system).toMatch(/Nunca inventes/);
  });

  it("includes the current summary when present", () => {
    const { user } = buildMemoryUpdatePrompt("Es un espadachín cauteloso.", "Perdió su primer duelo.");
    expect(user).toContain("Es un espadachín cauteloso.");
    expect(user).toContain("Perdió su primer duelo.");
  });

  it("handles a missing current summary gracefully", () => {
    const { user } = buildMemoryUpdatePrompt(undefined, "Su primer combate.");
    expect(user).toContain("todavía no hay ninguno");
  });
});
