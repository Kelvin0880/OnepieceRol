import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { busterCallChance, rollBusterCall, waveEnemy, waveRewards, bombardmentDamage, busterStatusNow, BUSTER_WAVES, BUSTER_DURATION_MS } from "./buster-call";

describe("busterCallChance", () => {
  it("never for shallow cells, rising with depth, certain at the bottom", () => {
    expect([0, 1, 2].map(busterCallChance)).toEqual([0, 0, 0]);
    expect(busterCallChance(3)).toBeLessThan(busterCallChance(4));
    expect(busterCallChance(5)).toBe(1);
    expect(busterCallChance(6)).toBe(1);
  });
  it("rollBusterCall respects the chances", () => {
    for (let s = 0; s < 100; s++) expect(rollBusterCall(mulberry32(s), 1)).toBe(false);
    for (let s = 0; s < 100; s++) expect(rollBusterCall(mulberry32(s), 6)).toBe(true);
    let hits = 0;
    for (let s = 0; s < 2000; s++) if (rollBusterCall(mulberry32(s), 4)) hits++;
    expect(hits / 2000).toBeGreaterThan(0.54);
    expect(hits / 2000).toBeLessThan(0.66);
  });
});

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
