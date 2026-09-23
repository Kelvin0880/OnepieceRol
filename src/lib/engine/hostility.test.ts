import { describe, it, expect } from "vitest";
import { areHostile, huntBlockReason, HUNT_MIN_TARGET_LEVEL, HUNT_ONLINE_WINDOW_MS, HUNT_REPEAT_COOLDOWN_MS } from "./hostility";

describe("areHostile", () => {
  it("marines and CP-0 hunt pirates and revolutionaries", () => {
    expect(areHostile("MARINE", "PIRATE")).toBe(true);
    expect(areHostile("CP0", "REVOLUTIONARY")).toBe(true);
    expect(areHostile("MARINE", "REVOLUTIONARY")).toBe(true);
  });

  it("is symmetric and pirates are hostile to every other flag", () => {
    for (const f of ["MARINE", "REVOLUTIONARY", "BOUNTY_HUNTER", "CP0"] as const) {
      expect(areHostile("PIRATE", f)).toBe(true);
      expect(areHostile(f, "PIRATE")).toBe(true);
    }
  });

  it("the same faction is never hostile, and allies stay allied", () => {
    expect(areHostile("PIRATE", "PIRATE")).toBe(false);
    expect(areHostile("MARINE", "CP0")).toBe(false);
    expect(areHostile("BOUNTY_HUNTER", "MARINE")).toBe(false);
    expect(areHostile("REVOLUTIONARY", "BOUNTY_HUNTER")).toBe(false);
  });
});

describe("huntBlockReason", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const online = new Date(now.getTime() - 30_000);

  it("allows a hunt against an online, non-novice target", () => {
    expect(huntBlockReason({ targetLevel: 10, targetLastSeenAt: online, lastHuntEndedAt: null, now })).toBeNull();
  });

  it("protects novices", () => {
    expect(huntBlockReason({ targetLevel: HUNT_MIN_TARGET_LEVEL - 1, targetLastSeenAt: online, lastHuntEndedAt: null, now })).toMatch(/protección/);
  });

  it("never lets a hunt land on someone who is offline", () => {
    expect(huntBlockReason({ targetLevel: 10, targetLastSeenAt: null, lastHuntEndedAt: null, now })).toMatch(/conectada/);
    expect(huntBlockReason({ targetLevel: 10, targetLastSeenAt: new Date(now.getTime() - HUNT_ONLINE_WINDOW_MS - 1), lastHuntEndedAt: null, now })).toMatch(/conectada/);
  });

  it("stops the same hunter from harassing the same target back to back", () => {
    expect(huntBlockReason({ targetLevel: 10, targetLastSeenAt: online, lastHuntEndedAt: new Date(now.getTime() - 60_000), now })).toMatch(/respirar/);
    expect(huntBlockReason({ targetLevel: 10, targetLastSeenAt: online, lastHuntEndedAt: new Date(now.getTime() - HUNT_REPEAT_COOLDOWN_MS - 1), now })).toBeNull();
  });
});
