import { describe, expect, it } from "vitest";
import { bountyForFaction, canonDefeatBounty, CANON_BOUNTY_CAP, fameFactor } from "./bounty-impact";

describe("bountyForFaction", () => {
  it("moves a pirate's fight bounty into millions and leaves everyone else alone", () => {
    expect(bountyForFaction("PIRATE", 37_500)).toBe(1_125_000);
    expect(bountyForFaction("MARINE", 37_500)).toBe(37_500);
    expect(bountyForFaction("BOUNTY_HUNTER", 37_500)).toBe(37_500);
  });
});

describe("fameFactor", () => {
  it("is 1 for small posters and grows with fame up to triple", () => {
    expect(fameFactor(0)).toBe(1);
    expect(fameFactor(10_000_000)).toBe(1);
    expect(fameFactor(130_000_000)).toBe(1.5);
    expect(fameFactor(250_000_000)).toBe(2);
    expect(fameFactor(490_000_000)).toBe(3);
    expect(fameFactor(2_000_000_000)).toBe(3);
  });
});

describe("canonDefeatBounty", () => {
  it("beating the leader is worth much more than beating a subordinate", () => {
    const shanks = { powerLevel: 100, canonBounty: BigInt(4_048_900_000) };
    expect(canonDefeatBounty(shanks, "canon")).toBe(323_912_000);
    expect(canonDefeatBounty(shanks, "vanguard")).toBe(80_978_000);
    expect(canonDefeatBounty(shanks, "canon")).toBeGreaterThan(canonDefeatBounty(shanks, "guardian"));
  });
  it("follows who the character is: an unposted admiral is judged by power", () => {
    expect(canonDefeatBounty({ powerLevel: 92 }, "canon")).toBe(253_920_000);
    expect(canonDefeatBounty({ powerLevel: 92 }, "admiral")).toBe(203_136_000);
    expect(canonDefeatBounty({ powerLevel: 60 }, "canon")).toBe(108_000_000);
    expect(canonDefeatBounty({ powerLevel: 30 }, "canon")).toBe(27_000_000);
  });
  it("a small fry still pays something, and nothing goes past the cap", () => {
    expect(canonDefeatBounty({ powerLevel: 1 }, "vanguard")).toBeGreaterThan(0);
    expect(canonDefeatBounty({ powerLevel: 500, canonBounty: BigInt(90_000_000_000) }, "canon")).toBe(CANON_BOUNTY_CAP);
  });
  it("accepts a plain number for the canon bounty", () => {
    expect(canonDefeatBounty({ powerLevel: 40, canonBounty: 1_000_000_000 }, "canon")).toBe(80_000_000);
  });
});
