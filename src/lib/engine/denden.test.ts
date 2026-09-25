import { describe, expect, it } from "vitest";
import { DENDEN_MAX_LENGTH, channelFor, channelLabel, cleanMessage, crewChannelKey, parseScope, tooFast } from "./denden";

describe("den den mushi rules", () => {
  it("one channel per faction, case-insensitive", () => {
    expect(channelFor("pirate")).toBe("PIRATE");
    expect(channelFor(" MARINE ")).toBe("MARINE");
    expect(channelFor("PIRATE")).not.toBe(channelFor("MARINE"));
  });
  it("labels known factions in Spanish and falls back to the raw name", () => {
    expect(channelLabel("PIRATE")).toBe("Piratas");
    expect(channelLabel("CP0")).toBe("CP-0");
    expect(channelLabel("OTHER")).toBe("OTHER");
  });
  it("cleans and validates messages", () => {
    expect(cleanMessage("  hola  ")).toBe("hola");
    expect(cleanMessage("")).toBeNull();
    expect(cleanMessage("   \n  ")).toBeNull();
    expect(cleanMessage("a".repeat(DENDEN_MAX_LENGTH))).not.toBeNull();
    expect(cleanMessage("a".repeat(DENDEN_MAX_LENGTH + 1))).toBeNull();
    expect(cleanMessage("a\n\n\n\n\nb")).toBe("a\n\nb");
    expect(cleanMessage("a\u0001b")).toBe("ab");
  });
  it("crew channels never collide with a faction channel", () => {
    expect(crewChannelKey("abc")).toBe("CREW:abc");
    expect(crewChannelKey("abc")).not.toBe(channelFor("PIRATE"));
    expect(crewChannelKey("a")).not.toBe(crewChannelKey("b"));
  });
  it("scope defaults to the faction unless the crew is asked for", () => {
    expect(parseScope("crew")).toBe("crew");
    expect(parseScope("faction")).toBe("faction");
    expect(parseScope("CREW:x")).toBe("faction");
    expect(parseScope(null)).toBe("faction");
  });
  it("rate limits fast senders", () => {
    expect(tooFast(null, 5000)).toBe(false);
    expect(tooFast(4000, 5000)).toBe(true);
    expect(tooFast(1000, 5000)).toBe(false);
  });
});
