import { describe, it, expect } from "vitest";
import { buildSceneEnemy, isEnemyTier, tierXp } from "./scene-enemy";

const player = { name: "P", hp: 50, maxHp: 50, atk: 20, def: 16, spd: 10 };

describe("buildSceneEnemy", () => {
  it("scales stats monotonically with tier, elites sitting above the player", () => {
    const [w, a, t, e] = (["weak", "average", "tough", "elite"] as const).map((tier) => buildSceneEnemy("X", player, tier));
    expect(w.atk).toBeLessThan(a.atk);
    expect(a.atk).toBeLessThan(t.atk);
    expect(t.atk).toBeLessThan(e.atk);
    expect(e.atk).toBeGreaterThan(player.atk);
    expect(e.hp).toBeGreaterThan(player.maxHp);
  });

  it("names the enemy and starts at full health with sane floors", () => {
    const tiny = buildSceneEnemy("Borracho", { ...player, maxHp: 1, atk: 0, def: 0, spd: 0 }, "weak");
    expect(tiny.name).toBe("Borracho");
    expect(tiny.hp).toBe(tiny.maxHp);
    expect(tiny.hp).toBeGreaterThanOrEqual(10);
    expect(tiny.atk).toBeGreaterThanOrEqual(4);
  });

  it("validates tier labels and pays more xp for tougher foes", () => {
    expect(isEnemyTier("elite")).toBe(true);
    expect(isEnemyTier("godlike")).toBe(false);
    expect(tierXp("elite")).toBeGreaterThan(tierXp("weak"));
  });
});
