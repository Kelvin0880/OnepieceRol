import { describe, expect, it } from "vitest";
import { canFlee, defeatFate, surrenderAllowed } from "./fight-kind";

describe("canFlee", () => {
  it("nobody can run from an Admiral dispatch", () => {
    expect(canFlee("admiral")).toBe(false);
  });
  it("every other kind of fight allows fleeing", () => {
    for (const kind of ["party", "poneglyph", "conquest", "raid", "arc", "rescue", "canon", "canon_vanguard", "seat", "sovereign"]) {
      expect(canFlee(kind)).toBe(true);
    }
  });
});

describe("surrenderAllowed", () => {
  it("yielding is a real ending only where fleeing is impossible", () => {
    expect(surrenderAllowed("admiral")).toBe(true);
    expect(surrenderAllowed("party")).toBe(false);
    expect(surrenderAllowed("raid")).toBe(false);
  });
});

describe("defeatFate", () => {
  it("an Admiral always means custody, felled or still standing", () => {
    expect(defeatFate("admiral", "DOWN")).toBe("custody");
    expect(defeatFate("admiral", "FIGHTING")).toBe("custody");
  });
  it("a duel for a seat of command is never to the death", () => {
    expect(defeatFate("seat", "DOWN")).toBe("spared");
    expect(defeatFate("seat", "FIGHTING")).toBe("spared");
  });
  it("in any other fight the fallen face the death roll and the rest retreat alive", () => {
    expect(defeatFate("party", "DOWN")).toBe("death_roll");
    expect(defeatFate("party", "FIGHTING")).toBe("retreat");
    expect(defeatFate("raid", "DOWN")).toBe("death_roll");
    expect(defeatFate("canon", "FIGHTING")).toBe("retreat");
  });
});
