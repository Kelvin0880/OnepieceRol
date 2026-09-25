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

import { clampFightEnd } from "./judge";
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
