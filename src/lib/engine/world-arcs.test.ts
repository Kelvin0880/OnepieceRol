import { describe, it, expect } from "vitest";
import {
  ARC_COOLDOWN_MS,
  ARC_TOTAL_STAGES,
  CHAPTERS,
  ArcActor,
  appendContext,
  arcDue,
  arcEligible,
  arcTitle,
  chapterAt,
  chapterLocation,
  fillBrief,
  nextBeatTime,
  outcomeActorStatus,
  pickArcCast,
  shouldStartArc,
  verdictOutcome,
} from "./world-arcs";
import { mulberry32 } from "./rng";

const actor = (over: Partial<ArcActor> & { id: string; name: string }): ArcActor => ({ role: "NOTABLE_PIRATE", status: "ACTIVE", factionType: "PIRATE", powerLevel: 80, ...over });

describe("chapters", () => {
  it("there are exactly as many chapters as stages, and none of them reveals an ending", () => {
    expect(CHAPTERS).toHaveLength(ARC_TOTAL_STAGES);
    for (const c of CHAPTERS.slice(0, -1)) expect(c.brief).not.toMatch(/muere|capturad[oa] |derrotad[oa]/i);
    expect(CHAPTERS[CHAPTERS.length - 1].brief).toContain("NO reveles");
  });
  it("chapterAt clamps and fillBrief inserts names", () => {
    expect(chapterAt(0).kind).toBe("rumor");
    expect(chapterAt(99).kind).toBe("ultimatum");
    const t = fillBrief(CHAPTERS[1].brief, "Shanks", "Akainu");
    expect(t).toContain("Shanks");
    expect(t).toContain("Akainu");
    expect(fillBrief("{aggressor}", "X", null)).toBe("sus enemigos");
  });
});

describe("arcDue / nextBeatTime", () => {
  const base = { status: "ACTIVE", nextBeatAt: new Date("2026-01-01T10:00:00Z"), stage: 2, totalStages: 6 };
  it("is due only when running, on time and unfinished", () => {
    expect(arcDue(base, new Date("2026-01-01T10:00:01Z"))).toBe(true);
    expect(arcDue(base, new Date("2026-01-01T09:00:00Z"))).toBe(false);
    expect(arcDue({ ...base, status: "AWAITING_CONSENT" }, new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(arcDue({ ...base, stage: 6 }, new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });
  it("spaces chapters hours apart, with some jitter", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const t = nextBeatTime(now, mulberry32(3)).getTime() - now.getTime();
    expect(t).toBeGreaterThan(5 * 3600 * 1000);
    expect(t).toBeLessThan(11 * 3600 * 1000);
  });
});

describe("casting", () => {
  const cast = [
    actor({ id: "1", name: "Pirata A", factionType: "PIRATE", powerLevel: 90 }),
    actor({ id: "2", name: "Marine B", factionType: "MARINE", powerLevel: 88, role: "ADMIRAL" }),
    actor({ id: "3", name: "Rev C", factionType: "REVOLUTIONARY", powerLevel: 85 }),
    actor({ id: "4", name: "CP D", factionType: "CIPHER_POL", powerLevel: 84 }),
  ];
  it("never raffles endgame pieces, the dead or civilians", () => {
    expect(arcEligible(actor({ id: "x", name: "Thalassa" }))).toBe(false);
    expect(arcEligible(actor({ id: "x", name: "Y", role: "GOROSEI" }))).toBe(false);
    expect(arcEligible(actor({ id: "x", name: "Y", status: "DECEASED" }))).toBe(false);
    expect(arcEligible(actor({ id: "x", name: "Y", factionType: "CIVILIAN" }))).toBe(false);
    expect(arcEligible(actor({ id: "x", name: "Y", status: "CAPTURED" }))).toBe(false);
  });
  it("always pairs a target with a different, credible rival of an opposing side", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const c = pickArcCast(mulberry32(seed), cast);
      if (!c) continue;
      expect(c.aggressor.id).not.toBe(c.target.id);
      expect(c.aggressor.powerLevel).toBeGreaterThanOrEqual(c.target.powerLevel - 20);
      if (c.target.factionType === "REVOLUTIONARY") expect(c.kind).toBe("capture");
      if (c.target.factionType === "MARINE") expect(c.kind).toBe("death");
    }
  });
  it("returns null when there is nobody to fight", () => {
    expect(pickArcCast(mulberry32(1), [actor({ id: "1", name: "Solo" })])).toBeNull();
    expect(pickArcCast(mulberry32(1), [actor({ id: "1", name: "A", factionType: "MARINE" }), actor({ id: "2", name: "B", factionType: "MARINE" })])).toBeNull();
  });
});

describe("shouldStartArc", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const base = { hasOpenArc: false, lastResolvedAt: null, heat: 50, now };
  it("only one arc at a time, only when the world is hot, and never right after another", () => {
    expect(shouldStartArc(() => 0, { ...base, hasOpenArc: true })).toBe(false);
    expect(shouldStartArc(() => 0, { ...base, heat: 5 })).toBe(false);
    expect(shouldStartArc(() => 0, { ...base, lastResolvedAt: new Date(now.getTime() - ARC_COOLDOWN_MS + 1000) })).toBe(false);
    expect(shouldStartArc(() => 0, base)).toBe(true);
  });
  it("is genuinely rare per tick", () => {
    let started = 0;
    for (let i = 1; i <= 2000; i++) if (shouldStartArc(mulberry32(i), base)) started++;
    expect(started).toBeGreaterThan(10);
    expect(started).toBeLessThan(90);
  });
});

describe("outcomes and helpers", () => {
  it("an approved verdict applies the arc kind; a denied one always ends in survival", () => {
    expect(verdictOutcome("death", true)).toBe("death");
    expect(verdictOutcome("capture", true)).toBe("capture");
    expect(verdictOutcome("death", false)).toBe("survived");
    expect(verdictOutcome("capture", false)).toBe("survived");
  });
  it("maps outcomes to the actor status", () => {
    expect(outcomeActorStatus("death")).toBe("DECEASED");
    expect(outcomeActorStatus("capture")).toBe("CAPTURED");
    expect(outcomeActorStatus("survived")).toBe("ACTIVE");
  });
  it("keeps only the most recent context lines", () => {
    let lines: string[] = [];
    for (let i = 0; i < 12; i++) lines = appendContext(lines, `l${i}`);
    expect(lines).toHaveLength(8);
    expect(lines[7]).toBe("l11");
  });
  it("titles differ by kind", () => {
    expect(arcTitle("capture", "Kid", "Smoker")).toContain("caza");
    expect(arcTitle("death", "Kid", "Smoker")).toContain("contra");
  });
  it("places chapters around the target, falling back gracefully", () => {
    const spots = { target: "A", aggressor: "B", nearTarget: "C", siege: "D" };
    expect([1, 2, 3, 4, 5, 6].map((s) => chapterLocation(s, spots))).toEqual(["A", "B", "A", "C", "D", "D"]);
    expect(chapterLocation(5, { target: "A", aggressor: null, nearTarget: null, siege: null })).toBe("A");
  });
});
