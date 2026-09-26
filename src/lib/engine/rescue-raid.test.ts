import { describe, expect, it } from "vitest";
import { rescueBlockReason, rescueRequirement, rescueRewards } from "./rescue-raid";

describe("rescue raid on Impel Down", () => {
  it("asks for more the deeper the cell", () => {
    const shallow = rescueRequirement(1);
    const deep = rescueRequirement(6);
    expect(deep.minLevel).toBeGreaterThan(shallow.minLevel);
    expect(deep.minPeople).toBeGreaterThan(shallow.minPeople);
    expect(deep.guardPower).toBeGreaterThan(shallow.guardPower);
    expect(rescueRequirement(99).minPeople).toBe(3);
  });
  it("refuses a group that is too small or too low", () => {
    expect(rescueBlockReason({ cell: 5, levels: [60, 60] })).toContain("3 personas");
    expect(rescueBlockReason({ cell: 6, levels: [60, 60, 46] })).toContain("nivel 55");
    expect(rescueBlockReason({ cell: 1, levels: [45] })).toBeNull();
    expect(rescueBlockReason({ cell: 6, levels: [55, 56, 57] })).toBeNull();
  });
  it("pays more for the deeper cells", () => {
    expect(rescueRewards(6, 94).xp).toBeGreaterThan(rescueRewards(1, 79).xp);
  });
});
