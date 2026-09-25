import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { consequenceDelayMs, consequenceRipe, OUTCOME_OPTIONS, boonRewards, tributeRewards, returningEnemy, nextStage, MAX_STAGE } from "./consequence";

describe("consequence timing", () => {
  it("a thread is ripe only after its delay", () => {
    expect(consequenceRipe(1000, 999)).toBe(false);
    expect(consequenceRipe(1000, 1000)).toBe(true);
    expect(consequenceDelayMs("killed")).toBeLessThan(consequenceDelayMs("spared"));
  });
});

describe("scaling", () => {
  it("rewards grow with the stage and are capped", () => {
    expect(boonRewards(2, 5).berries).toBeGreaterThan(boonRewards(1, 5).berries);
    expect(boonRewards(99, 5)).toEqual(boonRewards(MAX_STAGE, 5));
    expect(tributeRewards(3, 4).notoriety).toBeGreaterThan(tributeRewards(1, 4).notoriety);
  });
  it("returning enemies toughen per stage and avengers hit harder than betrayers", () => {
    const p = { maxHp: 100, atk: 20, def: 10, spd: 10 };
    expect(returningEnemy(p, "avenger", 3).hp).toBeGreaterThan(returningEnemy(p, "avenger", 1).hp);
    expect(returningEnemy(p, "avenger", 2).atk).toBeGreaterThan(returningEnemy(p, "betrayal", 2).atk);
  });
  it("the thread ends after the last stage", () => {
    expect(nextStage(1)).toBe(2);
    expect(nextStage(MAX_STAGE)).toBeNull();
  });
});

describe("outcomes branch by choice", () => {
  it("sparing can only come back as a boon or a betrayal, killing as an avenger or tribute", () => {
    expect(OUTCOME_OPTIONS.spared).toEqual(["boon", "betrayal"]);
    expect(OUTCOME_OPTIONS.killed).toEqual(["avenger", "tribute"]);
  });
});
