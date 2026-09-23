import { describe, it, expect } from "vitest";
import { buildExploreNarrationPrompt, buildCombatNarrationPrompt, ExploreNarrationInput, CombatNarrationInput } from "./narrate-prompt";

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
});

const combatBase: CombatNarrationInput = {
  characterName: "Kaze",
  enemyName: "Bandido",
  isBoss: false,
  rounds: [
    { attacker: "Kaze", defender: "Bandido", damage: 12 },
    { attacker: "Bandido", defender: "Kaze", damage: 0 },
  ],
  victor: "player",
  playerHpLeft: 38,
  playerMaxHp: 50,
};

describe("buildCombatNarrationPrompt", () => {
  it("instructs the model never to alter or invent the outcome", () => {
    const { system } = buildCombatNarrationPrompt(combatBase);
    expect(system).toMatch(/NUNCA cambies, inventes/);
  });

  it("includes the final victor and remaining HP", () => {
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
});
