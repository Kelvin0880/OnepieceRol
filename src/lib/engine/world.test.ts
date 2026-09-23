import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { runWorldTick, WorldEventTemplateSpec, WorldActorState } from "./world";

const now = new Date("2026-01-01T00:00:00Z");

const calmTemplate: WorldEventTemplateSpec = {
  id: "calm",
  weight: 10,
  minHeat: 0,
  headline: "{actor} se mueve en las sombras",
  category: "Gobierno Mundial",
  bodyVariants: ["{actor} fue visto zarpando hacia el oeste."],
  busyHours: [4, 8],
  heatDelta: 1,
};

const lateGameTemplate: WorldEventTemplateSpec = {
  id: "late",
  weight: 10,
  minHeat: 80,
  headline: "Guerra total: {actor} desafía al mundo",
  category: "Guerra",
  bodyVariants: ["El equilibrio de poder se rompe."],
};

const actors: WorldActorState[] = [
  { id: "a1", name: "Kizaru", role: "ADMIRAL", busyUntil: null },
  { id: "a2", name: "Shanks", role: "YONKO", busyUntil: new Date("2026-01-02T00:00:00Z") }, // busy in the future
];

describe("runWorldTick", () => {
  it("returns null when no template meets the current heat threshold", () => {
    const result = runWorldTick(mulberry32(1), now, 0, [lateGameTemplate], actors);
    expect(result).toBeNull();
  });

  it("fires a low-heat template even at heat 0", () => {
    const result = runWorldTick(mulberry32(1), now, 0, [calmTemplate], actors);
    expect(result).not.toBeNull();
  });

  it("only ever picks an actor who is not currently busy", () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = runWorldTick(mulberry32(seed), now, 0, [calmTemplate], actors);
      expect(result?.involvedActorId).not.toBe("a2"); // Shanks is busy until tomorrow
    }
  });

  it("falls back to a generic actor name when nobody is available", () => {
    const allBusy: WorldActorState[] = [{ id: "a1", name: "Kizaru", role: "ADMIRAL", busyUntil: new Date("2099-01-01") }];
    const result = runWorldTick(mulberry32(1), now, 0, [calmTemplate], allBusy);
    expect(result?.involvedActorId).toBeNull();
    expect(result?.headline).toContain("Gobierno Mundial");
  });

  it("sets a busyUntil window strictly after `now` when the template specifies busyHours", () => {
    const result = runWorldTick(mulberry32(2), now, 0, [calmTemplate], actors);
    expect(result?.newBusyUntil).not.toBeNull();
    expect(result!.newBusyUntil!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("clamps heat within [0, 100]", () => {
    const maxHeatTemplate: WorldEventTemplateSpec = { ...calmTemplate, heatDelta: 1000 };
    const result = runWorldTick(mulberry32(1), now, 99, [maxHeatTemplate], actors);
    expect(result?.newHeat).toBe(100);

    const minHeatTemplate: WorldEventTemplateSpec = { ...calmTemplate, heatDelta: -1000 };
    const result2 = runWorldTick(mulberry32(1), now, 5, [minHeatTemplate], actors);
    expect(result2?.newHeat).toBe(0);
  });

  it("headline and body never contain the literal {actor} placeholder", () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = runWorldTick(mulberry32(seed), now, 0, [calmTemplate], actors);
      expect(result?.headline).not.toContain("{actor}");
      expect(result?.body).not.toContain("{actor}");
    }
  });
});
