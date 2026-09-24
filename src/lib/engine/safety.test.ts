import { describe, it, expect } from "vitest";
import { dangerBlockReason, DangerContext } from "./safety";

const calm: DangerContext = { hasPendingEncounter: false, activeDuel: false, hostileChallengePending: false, inJointFight: false, busterCallOnIsland: false };

describe("dangerBlockReason", () => {
  it("allows resting and training when nothing threatens you", () => {
    expect(dangerBlockReason(calm, "descansar")).toBeNull();
    expect(dangerBlockReason(calm, "entrenar")).toBeNull();
  });
  it.each([
    ["hasPendingEncounter", "enfrentamiento"],
    ["activeDuel", "duelo"],
    ["inJointFight", "pelea"],
    ["hostileChallengePending", "cazando"],
    ["busterCallOnIsland", "Buster Call"],
  ] as const)("blocks both actions when %s", (key, word) => {
    const ctx = { ...calm, [key]: true };
    expect(dangerBlockReason(ctx, "descansar")).toContain(word);
    expect(dangerBlockReason(ctx, "entrenar")).toContain(word);
  });
  it("names the action being refused", () => {
    expect(dangerBlockReason({ ...calm, activeDuel: true }, "entrenar")).toContain("entrenar");
  });
});
