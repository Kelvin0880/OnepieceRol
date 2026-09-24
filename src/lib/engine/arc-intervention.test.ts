import { describe, it, expect } from "vitest";
import { actorCombatStats } from "./guardian";
import {
  Contribution,
  InterventionCheck,
  SAVE_THRESHOLD,
  addContribution,
  interventionBlockReason,
  interventionMinLevel,
  interventionTilt,
  isInterventionSide,
  tally,
  vanguardFor,
} from "./arc-intervention";

const c = (id: string, side: Contribution["side"], stage = 3): Contribution => ({ characterId: id, name: id, side, stage, level: 30 });

describe("interventionMinLevel", () => {
  it("scales with the weaker side and never goes below 10", () => {
    expect(interventionMinLevel(90, 96)).toBe(30);
    expect(interventionMinLevel(30, 90)).toBe(10);
    expect(interventionMinLevel(99, 60)).toBe(20);
  });
});

describe("interventionBlockReason", () => {
  const ok: InterventionCheck = { arcStatus: "ACTIVE", stage: 4, totalStages: 6, playerIslandId: "A", arcIslandId: "A", level: 40, minLevel: 30, alreadyThisStage: false };
  it("allows a strong player standing at the place after the clash began", () => expect(interventionBlockReason(ok)).toBeNull());
  it.each([
    [{ arcStatus: "RESOLVED" }, "terminó"],
    [{ stage: 2 }, "pronto"],
    [{ arcIslandId: "B" }, "otro lugar"],
    [{ arcIslandId: null }, "otro lugar"],
    [{ level: 12 }, "nivel"],
    [{ alreadyThisStage: true }, "capítulo"],
  ] as [Partial<InterventionCheck>, string][])("refuses %j", (patch, word) => {
    expect(interventionBlockReason({ ...ok, ...patch })).toContain(word);
  });
  it("still allows stepping in while the verdict is pending", () => expect(interventionBlockReason({ ...ok, arcStatus: "AWAITING_CONSENT", stage: 6 })).toBeNull());
});

describe("vanguardFor", () => {
  const target = { name: "Kid", power: 85 };
  const aggressor = { name: "Smoker", power: 82 };
  it("names and picks the right force for each side", () => {
    expect(vanguardFor("defend", target, aggressor, 4).name).toContain("Smoker");
    expect(vanguardFor("assist", target, aggressor, 4).name).toContain("Kid");
    expect(vanguardFor("chaos", target, aggressor, 4).name).toContain("y de");
  });
  it("is a vanguard: clearly weaker than the canon character in person, and it grows with the chapter", () => {
    const real = actorCombatStats(aggressor.power);
    const v = vanguardFor("defend", target, aggressor, 4);
    expect(v.hp).toBeLessThan(real.hp);
    expect(v.atk).toBeLessThan(real.atk);
    expect(vanguardFor("defend", target, aggressor, 6).hp).toBeGreaterThan(vanguardFor("defend", target, aggressor, 3).hp);
    expect(v.isBoss).toBe(true);
  });
});

describe("tally and tilt", () => {
  it("chaos counts half for the defenders", () => expect(tally([c("a", "chaos"), c("b", "chaos")])).toEqual({ defend: 1, assist: 0 }));
  it("enough defenders save the target outright", () => {
    const defenders = Array.from({ length: SAVE_THRESHOLD }, (_, i) => c(`d${i}`, "defend"));
    expect(interventionTilt(defenders)).toBe("saved");
    expect(interventionTilt(defenders.slice(0, SAVE_THRESHOLD - 1))).toBe("open");
  });
  it("defenders outnumbered by the aggressor's helpers do not save anyone", () => {
    const mixed = [c("d1", "defend"), c("d2", "defend"), c("d3", "defend"), c("a1", "assist"), c("a2", "assist"), c("a3", "assist"), c("a4", "assist")];
    expect(interventionTilt(mixed)).toBe("tilted_to_aggressor");
  });
  it("a tie never saves", () => {
    const tie = [c("d1", "defend"), c("d2", "defend"), c("d3", "defend"), c("a1", "assist"), c("a2", "assist"), c("a3", "assist")];
    expect(interventionTilt(tie)).toBe("open");
  });
});

describe("addContribution", () => {
  it("scores a player once per chapter, but again in a later one", () => {
    let list: Contribution[] = [];
    list = addContribution(list, c("p", "defend", 3));
    list = addContribution(list, c("p", "assist", 3));
    expect(list).toHaveLength(1);
    list = addContribution(list, c("p", "defend", 4));
    expect(list).toHaveLength(2);
  });
});

describe("isInterventionSide", () => {
  it("accepts only the three sides", () => {
    expect(isInterventionSide("defend")).toBe(true);
    expect(isInterventionSide("attack")).toBe(false);
  });
});
