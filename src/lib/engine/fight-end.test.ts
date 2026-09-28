import { describe, expect, it } from "vitest";
import { parseFightEndVerdict, stubFightEnd } from "./judge";

describe("fight end verdict", () => {
  it("parses the three outcomes in Spanish or English", () => {
    expect(parseFightEndVerdict('{"resultado":"gana_jugador","motivo":"El rival cayó."}')).toEqual({ outcome: "player_won", reason: "El rival cayó." });
    expect(parseFightEndVerdict('{"resultado":"pierde_jugador"}')?.outcome).toBe("player_lost");
    expect(parseFightEndVerdict('{"outcome":"ended"}')?.outcome).toBe("ended");
  });
  it("rejects anything else so a garbled answer never decides a fight", () => {
    expect(parseFightEndVerdict('{"resultado":"quizás"}')).toBeNull();
    expect(parseFightEndVerdict("no json")).toBeNull();
  });
  it("stand-in: who has more life left won", () => {
    expect(stubFightEnd(80, 100, 10, 100)).toBe("player_won");
    expect(stubFightEnd(10, 100, 80, 100)).toBe("player_lost");
    expect(stubFightEnd(50, 100, 50, 100)).toBe("ended");
  });
});

import { clampFightEnd, clampJointEnd, refereeLines, rivalNarratedFallen } from "./judge";
describe("clampFightEnd", () => {
  it("does not hand a win to someone whose rival is still above half life", () => {
    expect(clampFightEnd("player_won", 90, 100, 80, 100)).toBe("ended");
    expect(clampFightEnd("player_won", 90, 100, 40, 100)).toBe("player_won");
  });
  it("does not hand a loss to a player above half life", () => {
    expect(clampFightEnd("player_lost", 80, 100, 10, 100)).toBe("ended");
    expect(clampFightEnd("player_lost", 30, 100, 10, 100)).toBe("player_lost");
  });
  it("keeps 'ended' as it is", () => {
    expect(clampFightEnd("ended", 1, 100, 1, 100)).toBe("ended");
  });
});

// Reported 2026-09-28 (Sebastian vs Elena Rivales): the referee narrated the resident dead twice but its life bound never
// booked it, so "Finalizar pelea" closed with no winner and nothing was paid.
describe("a fall the referee itself narrated", () => {
  const killed = ["El golpe de tu daga impacta en el estómago de Elena, causándole un daño significativo. La hoja atraviesa su cráneo.\n\nElena Rivales cae al suelo, sin vida, con una expresión de sorpresa marcada en su rostro."];
  it("is accepted as a win even though the booked life is still above half", () => {
    expect(rivalNarratedFallen(killed, "Elena Rivales")).toBe(true);
    expect(clampFightEnd("player_won", 90, 109, 80, 100, true)).toBe("player_won");
    expect(clampJointEnd("player_won", [{ hp: 90, maxHp: 100 }], 88, 88, false, true)).toBe("player_won");
  });
  it("matches by first name too, and by the later 'yace muerta' message", () => {
    expect(rivalNarratedFallen(["Elena yace muerta en el suelo."], "Elena Rivales")).toBe(true);
  });
  it("ignores other people falling, negations and near misses", () => {
    expect(rivalNarratedFallen(["Bruto cae inconsciente junto a la puerta."], "Elena Rivales")).toBe(false);
    expect(rivalNarratedFallen(["Elena no cae: se sostiene con una rodilla en el suelo."], "Elena Rivales")).toBe(false);
    expect(rivalNarratedFallen(["Elena casi queda inconsciente por el golpe, pero se levanta."], "Elena Rivales")).toBe(false);
    expect(rivalNarratedFallen(["Sus compañeros lamentan la muerte de su aliada."], "Elena Rivales")).toBe(false);
  });
  it("only counts the last messages: an old fall that the story moved past does not close a fresh fight", () => {
    expect(rivalNarratedFallen(["Elena cae sin vida.", "El siguiente rival avanza.", "Otro golpe."], "Elena Rivales", 2)).toBe(false);
  });
  it("only reads referee lines, never the players' own text", () => {
    const log = ["[Jugador]: Elena Rivales cae sin vida, la mato de un golpe.", "[Árbitro]: Elena se tambalea, herida pero en pie."];
    expect(rivalNarratedFallen(refereeLines(log), "Elena Rivales")).toBe(false);
    expect(refereeLines(log)).toEqual(["Elena se tambalea, herida pero en pie."]);
  });
  it("never turns a loss or a no-winner verdict into a win by itself", () => {
    expect(clampFightEnd("player_lost", 80, 100, 10, 100, true)).toBe("ended");
    expect(clampFightEnd("ended", 80, 100, 90, 100, true)).toBe("ended");
  });
});
