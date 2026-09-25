import { describe, expect, it } from "vitest";
import { MAX_VOYAGE_MS, SAIL_ANYWHERE_LEVEL, canSailAnywhere, describeVoyageWait, hopsBetween, isYonkoClass, voyageDurationMs, voyageStatus } from "./voyage";

const graph = { a: ["b"], b: ["a", "c"], c: ["b", "d"], d: ["c"], lone: [] as string[] };

describe("hopsBetween", () => {
  it("counts the fewest hops along the chain", () => {
    expect(hopsBetween(graph, "a", "b")).toBe(1);
    expect(hopsBetween(graph, "a", "d")).toBe(3);
    expect(hopsBetween(graph, "d", "a")).toBe(3);
  });
  it("is 0 for the same island and null when unreachable", () => {
    expect(hopsBetween(graph, "a", "a")).toBe(0);
    expect(hopsBetween(graph, "a", "lone")).toBeNull();
    expect(hopsBetween(graph, "a", "missing")).toBeNull();
  });
  it("prefers the shortcut when there are two routes", () => {
    expect(hopsBetween({ a: ["b", "z"], b: ["a", "c"], z: ["a", "c"], c: ["b", "z"] }, "a", "c")).toBe(2);
  });
});

describe("voyage duration", () => {
  it("takes 5 minutes per hop and never more than an hour", () => {
    expect(voyageDurationMs(1)).toBe(5 * 60_000);
    expect(voyageDurationMs(4)).toBe(20 * 60_000);
    expect(voyageDurationMs(40)).toBe(MAX_VOYAGE_MS);
  });
  it("treats 0 hops as at least one", () => {
    expect(voyageDurationMs(0)).toBe(5 * 60_000);
  });
});

describe("sailing anywhere", () => {
  it("unlocks at the threshold level", () => {
    expect(canSailAnywhere(SAIL_ANYWHERE_LEVEL - 1)).toBe(false);
    expect(canSailAnywhere(SAIL_ANYWHERE_LEVEL)).toBe(true);
  });
});

describe("voyageStatus", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("is not at sea without a voyage", () => {
    expect(voyageStatus(null, now)).toEqual({ atSea: false, arrived: false, msLeft: 0 });
  });
  it("is at sea until the arrival time, then arrived", () => {
    expect(voyageStatus(new Date(now.getTime() + 90_000), now)).toEqual({ atSea: true, arrived: false, msLeft: 90_000 });
    expect(voyageStatus(new Date(now.getTime() - 1), now)).toEqual({ atSea: false, arrived: true, msLeft: 0 });
  });
  it("formats the wait in whole minutes, at least one", () => {
    expect(describeVoyageWait(10_000)).toBe("1 min");
    expect(describeVoyageWait(150_000)).toBe("3 min");
  });
});

describe("isYonkoClass", () => {
  it("recognises the title or a billion bounty", () => {
    expect(isYonkoClass("Yonko de la Isla del Toro Negro", 0)).toBe(true);
    expect(isYonkoClass(null, 1_500_000_000)).toBe(true);
    expect(isYonkoClass("Señor de Loguetown", 5_000_000)).toBe(false);
  });
});

import { pickSeaAmbush, seaAmbushChance, seaAmbushPower } from "./voyage";

describe("sea ambushes", () => {
  it("never happens on a single hop and grows with distance, capped", () => {
    expect(seaAmbushChance(1)).toBe(0);
    expect(seaAmbushChance(2)).toBeCloseTo(0.19);
    expect(seaAmbushChance(5)).toBeGreaterThan(seaAmbushChance(3));
    expect(seaAmbushChance(30)).toBe(0.55);
  });
  it("picks a faction-appropriate ambusher and falls back for unknown factions", () => {
    expect(pickSeaAmbush(() => 0, "PIRATE").name).toBe("Patrulla de la Marina");
    expect(pickSeaAmbush(() => 0, "MARINE").name).toBe("Corsarios sanguinarios");
    expect(pickSeaAmbush(() => 0.99, "REVOLUTIONARY").name).toBe("Rey del Mar");
    expect(pickSeaAmbush(() => 0, "NOPE").name).toBe("Patrulla de la Marina");
  });
  it("scales the ambusher with the distance, between 0.9 and 1.3", () => {
    expect(seaAmbushPower(0)).toBeCloseTo(0.9);
    expect(seaAmbushPower(5)).toBeCloseTo(1.1);
    expect(seaAmbushPower(99)).toBe(1.3);
  });
});
