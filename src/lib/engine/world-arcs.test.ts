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
  it("features the kept-alive Emperors far more often than chance would", () => {
    const withStars = [...cast, actor({ id: "k", name: "Kaido", factionType: "PIRATE", powerLevel: 99 }), actor({ id: "m", name: "Marina X", factionType: "MARINE", powerLevel: 95 })];
    let plain = 0;
    let boosted = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (pickArcCast(mulberry32(seed), withStars)?.target.name === "Kaido") plain++;
      if (pickArcCast(mulberry32(seed), withStars, ["Kaido"])?.target.name === "Kaido") boosted++;
    }
    expect(boosted).toBeGreaterThan(plain * 2);
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

import { pickReclaimCast, reclaimAspirantWins, narrationKind, outcomeActorStatus as outcomeStatus, verdictOutcome as verdictOf, arcTitle as titleOf } from "./world-arcs";

describe("reclaiming the Yonko throne", () => {
  const A = (id: string, name: string, role: string, status: string) => ({ id, name, role, status, factionType: "PIRATE", powerLevel: 95 });
  const rng = () => 0.1;
  it("pairs a defeated aspirant with a sitting Yonko, never the other way", () => {
    const cast = pickReclaimCast(rng, [A("1", "Kaido", "NOTABLE_PIRATE", "DEFEATED"), A("2", "Shanks", "YONKO", "ACTIVE"), A("3", "Buggy", "NOTABLE_PIRATE", "ACTIVE")]);
    expect(cast?.aggressor.name).toBe("Kaido");
    expect(cast?.target.name).toBe("Shanks");
    expect(cast?.kind).toBe("reclaim");
  });
  it("needs both an aspirant and a sitting Yonko", () => {
    expect(pickReclaimCast(rng, [A("2", "Shanks", "YONKO", "ACTIVE")])).toBeNull();
    expect(pickReclaimCast(rng, [A("1", "Kaido", "NOTABLE_PIRATE", "DEFEATED")])).toBeNull();
    expect(pickReclaimCast(rng, [A("1", "Kaido", "NOTABLE_PIRATE", "ACTIVE"), A("2", "Shanks", "YONKO", "ACTIVE")])).toBeNull();
  });
  it("defenders who saved the day beat the judge; otherwise the judge decides", () => {
    expect(reclaimAspirantWins("saved", true)).toBe(false);
    expect(reclaimAspirantWins("none", true)).toBe(true);
    expect(reclaimAspirantWins("none", false)).toBe(false);
  });
  it("a defeated aspirant that survives stays defeated, and never becomes a plain capture kind", () => {
    expect(outcomeStatus("survived", "DEFEATED")).toBe("DEFEATED");
    expect(outcomeStatus("survived", "ACTIVE")).toBe("ACTIVE");
    expect(outcomeStatus("capture", "DEFEATED")).toBe("CAPTURED");
    expect(verdictOf("reclaim_lost", true)).toBe("capture");
    expect(verdictOf("reclaim_lost", false)).toBe("survived");
    expect(narrationKind("reclaim")).toBe("capture");
    expect(titleOf("reclaim", "Shanks", "Kaido")).toContain("Kaido");
  });
});

describe("prison arcs", () => {
  const now = new Date("2026-01-02T12:00:00Z");
  const held = (over: Record<string, unknown> = {}) => ({ id: "d", name: "Doflamingo", factionName: "Familia Donquixote (encarcelado)", powerLevel: 93, capturedAt: new Date("2026-01-01T00:00:00Z"), prisonLevel: 6, ...over });
  const actor = (id: string, power: number, faction = "Familia Donquixote") => ({ id, name: id, role: "NOTABLE_PIRATE", status: "ACTIVE", factionType: "PIRATE", powerLevel: power, factionName: faction });
  const rngOf = (v: number) => () => v;
  it("only prisoners held long enough try to get out", async () => {
    const { pickPrisonCast } = await import("./world-arcs");
    expect(pickPrisonCast(rngOf(0.1), [held({ capturedAt: new Date("2026-01-02T10:00:00Z") })], [], null, now)).toBeNull();
    expect(pickPrisonCast(rngOf(0.9), [held()], [], null, now)?.kind).toBe("breakout");
  });
  it("a strong free member of their own crew turns it into a rescue, never an invented rescuer", async () => {
    const { pickPrisonCast } = await import("./world-arcs");
    const cast = pickPrisonCast(rngOf(0.1), [held()], [actor("Diamante", 78), actor("Debil", 20), actor("Otro", 90, "Marina")], null, now);
    expect(cast?.kind).toBe("crew_rescue");
    expect(cast?.aggressor?.id).toBe("Diamante");
    expect(pickPrisonCast(rngOf(0.1), [held()], [actor("Otro", 90, "Marina")], null, now)?.kind).toBe("breakout");
  });
  it("chapters never reveal the outcome and the deeper cell is harder", async () => {
    const { chaptersFor, isPrisonKind, prisonDefensePower, PRISON_TOTAL_STAGES } = await import("./world-arcs");
    expect(isPrisonKind("breakout") && isPrisonKind("crew_rescue") && !isPrisonKind("death")).toBe(true);
    for (const k of ["breakout", "crew_rescue"]) {
      const list = chaptersFor(k);
      expect(list).toHaveLength(PRISON_TOTAL_STAGES);
      expect(list[list.length - 1].brief).toContain("NO reveles");
    }
    expect(prisonDefensePower(6, 70)).toBeGreaterThan(prisonDefensePower(1, 70));
  });
});
