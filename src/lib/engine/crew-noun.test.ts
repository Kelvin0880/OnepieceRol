import { describe, it, expect } from "vitest";
import { crewNounForFaction } from "./crew-noun";

describe("crewNounForFaction", () => {
  it("gives every faction a distinct noun", () => {
    const nouns = new Set([
      crewNounForFaction("PIRATE"),
      crewNounForFaction("MARINE"),
      crewNounForFaction("REVOLUTIONARY"),
      crewNounForFaction("BOUNTY_HUNTER"),
    ]);
    expect(nouns.size).toBe(4);
  });

  it("uses the canon-flavored terms", () => {
    expect(crewNounForFaction("PIRATE")).toBe("Tripulación");
    expect(crewNounForFaction("MARINE")).toBe("Escuadrón");
  });
});
