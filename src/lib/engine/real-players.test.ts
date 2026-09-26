import { describe, expect, it } from "vitest";
import { realPlayersBlock, voicesRealPlayer } from "./real-players";

const NAMES = ["Barbosa", "Sebastián"];

describe("voicesRealPlayer (real report, 2026-09-26: the narrator spoke for Barbosa)", () => {
  it("flags dialogue and actions given to a real player's character", () => {
    expect(voicesRealPlayer('La voz de Barbosa llegó de nuevo. "¡Ah, cosas que hacer!"', NAMES)).toBe("Barbosa");
    expect(voicesRealPlayer('"Cuidado", dijo Barbosa, cruzando los brazos.', NAMES)).toBe("Barbosa");
    expect(voicesRealPlayer("Barbosa, tu compañero, se acerca por el camino de tierra.", NAMES)).toBe("Barbosa");
    expect(voicesRealPlayer("Barbosa escupió al suelo y miró hacia las colinas.", NAMES)).toBe("Barbosa");
    expect(voicesRealPlayer("Barbosa: ¿vienes o no?", NAMES)).toBe("Barbosa");
    expect(voicesRealPlayer("Sebastian dio media vuelta.", NAMES)).toBe("Sebastián");
  });
  it("allows plain mentions and unrelated NPC speech", () => {
    expect(voicesRealPlayer("El tipo con cara de mapache tenía razón sobre Barbosa.", NAMES)).toBeNull();
    expect(voicesRealPlayer("Golton dijo que Barbosa había pasado por el muelle ayer.", NAMES)).toBeNull();
    expect(voicesRealPlayer("Recuerdas la pelea junto a Barbosa. El herrero te mira y gruñe.", NAMES)).toBeNull();
    expect(voicesRealPlayer("Golton asintió. Nada más que contar.", NAMES)).toBeNull();
  });
});

describe("realPlayersBlock", () => {
  it("is empty without players and lists them otherwise", () => {
    expect(realPlayersBlock([])).toBe("");
    const b = realPlayersBlock([{ name: "Barbosa", relation: "tripulante, en esta isla" }]);
    expect(b).toContain("Barbosa (tripulante, en esta isla)");
    expect(b).toContain("NUNCA");
  });
});
