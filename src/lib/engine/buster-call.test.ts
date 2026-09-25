import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { busterCallTriggered, waveEnemy, waveRewards, bombardmentDamage, busterStatusNow, BUSTER_WAVES, BUSTER_DURATION_MS } from "./buster-call";

describe("waves", () => {
  it("each wave is stronger and pays more", () => {
    const w = [1, 2, 3].map((n) => waveEnemy(n, 10));
    expect(w[1].atk).toBeGreaterThan(w[0].atk);
    expect(w[2].atk).toBeGreaterThan(w[1].atk);
    expect(waveRewards(3, 10).berries).toBeGreaterThan(waveRewards(1, 10).berries);
  });
  it("clamps out-of-range wave numbers", () => {
    expect(waveEnemy(0, 10)).toEqual(waveEnemy(1, 10));
    expect(waveEnemy(9, 10)).toEqual(waveEnemy(BUSTER_WAVES, 10));
  });
});

describe("bombardment and status", () => {
  it("bombardment takes most, but not all, of max HP", () => {
    expect(bombardmentDamage(100)).toBe(70);
  });
  it("a siege is repelled once every wave is broken, falls when time runs out, otherwise stays active", () => {
    const end = 1_000_000 + BUSTER_DURATION_MS;
    expect(busterStatusNow(BUSTER_WAVES, end, end + 1)).toBe("REPELLED");
    expect(busterStatusNow(1, end, end + 1)).toBe("FALLEN");
    expect(busterStatusNow(1, end, end - 1)).toBe("ACTIVE");
  });
});

describe("busterCallTriggered", () => {
  it("never from shallow cells, only a spectacular breakout from level 3, always from the deeper ones", () => {
    expect([0, 1, 2].map((c) => busterCallTriggered(c, true))).toEqual([false, false, false]);
    expect(busterCallTriggered(3, false)).toBe(false);
    expect(busterCallTriggered(3, true)).toBe(true);
    expect(busterCallTriggered(4, false)).toBe(true);
    expect(busterCallTriggered(6, false)).toBe(true);
  });
});
