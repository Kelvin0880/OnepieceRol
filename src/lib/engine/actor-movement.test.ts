import { describe, it, expect } from "vitest";
import { pickMoves, locationLabel, seaLabel, whereLabel, describePresence, MovableActor, MAX_MOVES_PER_TICK, UNKNOWN_LOCATION } from "./actor-movement";
import { mulberry32 } from "./rng";

const nb = (id: string) => ({ A: ["B", "C"], B: ["A", "C"], C: ["A", "B", "D"], D: ["C"] } as Record<string, string[]>)[id] ?? [];
const actor = (over: Partial<MovableActor> & { id: string }): MovableActor => ({ name: over.id, factionType: "PIRATE", role: "NOTABLE_PIRATE", status: "ACTIVE", currentIslandId: "A", homeIslandId: "A", pinned: false, ...over });

describe("pickMoves", () => {
  it("places anyone without a location at home, so nobody is ever nowhere", () => {
    const m = pickMoves(mulberry32(1), [actor({ id: "x", currentIslandId: null, homeIslandId: "C" })], nb);
    expect(m).toEqual([{ actorId: "x", toIslandId: "C", hidden: false }]);
  });
  it("only ever moves to a neighbouring island and respects the per-tick cap", () => {
    const cast = Array.from({ length: 30 }, (_, i) => actor({ id: `p${i}` }));
    for (let seed = 1; seed <= 100; seed++) {
      const moves = pickMoves(mulberry32(seed), cast, nb);
      expect(moves.length).toBeLessThanOrEqual(MAX_MOVES_PER_TICK);
      for (const mv of moves) expect(nb("A")).toContain(mv.toIslandId);
    }
  });
  it("never moves the dead, the captured or pinned actors", () => {
    const cast = [actor({ id: "d", status: "DECEASED" }), actor({ id: "c", status: "CAPTURED" }), actor({ id: "pin", pinned: true })];
    for (let seed = 1; seed <= 200; seed++) expect(pickMoves(mulberry32(seed), cast, nb)).toEqual([]);
  });
  it("anchored roles (Yonko) rarely leave their turf; free roamers move often", () => {
    let yonko = 0;
    let pirate = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (pickMoves(mulberry32(seed), [actor({ id: "y", role: "YONKO" })], nb).length) yonko++;
      if (pickMoves(mulberry32(seed), [actor({ id: "p" })], nb).length) pirate++;
    }
    expect(yonko).toBeLessThan(pirate / 3);
  });
  it("secret services often move unseen; marines rarely do", () => {
    let cp = 0;
    let marine = 0;
    for (let seed = 1; seed <= 600; seed++) {
      cp += pickMoves(mulberry32(seed), [actor({ id: "c", factionType: "CIPHER_POL" })], nb).filter((m) => m.hidden).length;
      marine += pickMoves(mulberry32(seed), [actor({ id: "m", factionType: "MARINE" })], nb).filter((m) => m.hidden).length;
    }
    expect(cp).toBeGreaterThan(marine * 3);
  });
});

describe("locationLabel", () => {
  it("hidden or unknown locations are never revealed", () => {
    expect(locationLabel("Loguetown", false)).toBe("Loguetown");
    expect(locationLabel("Loguetown", true)).toBe(UNKNOWN_LOCATION);
    expect(locationLabel(null, false)).toBe(UNKNOWN_LOCATION);
    expect(UNKNOWN_LOCATION).toBe("Ubicación desconocida");
  });
});

describe("describePresence", () => {
  it("lists who is here, who is secretly here, who is nearby, and the etiquette for using them", () => {
    const t = describePresence({
      islandName: "Loguetown",
      here: [
        { name: "Smoker", role: "MARINE_GENERAL", factionName: "Marina", rankLabel: "Vicealmirante", hidden: false },
        { name: "Stussy", role: "CIPHER_POL", factionName: "CP-0", hidden: true },
      ],
      nearby: [{ name: "Buggy", islandName: "Reverse Mountain", hidden: false }, { name: "Dragon", islandName: "Baltigo", hidden: true }],
      worldEvents: ["La caza de Kid (capítulo 3/6)"],
    });
    expect(t).toContain("Smoker (Vicealmirante, Marina)");
    expect(t).toContain("Presentes en secreto");
    expect(t).toContain("Stussy");
    expect(t).toContain("Buggy en Reverse Mountain");
    expect(t).not.toContain("Dragon");
    expect(t).toContain("La caza de Kid");
    expect(t).toContain("JAMÁS mates ni captures");
  });
  it("says so when no canon is around, so the narrator does not invent cameos", () => {
    expect(describePresence({ islandName: "Isla Gecko", here: [], nearby: [] })).toContain("ningún personaje canon a la vista");
  });
});

describe("precise locations: island, sea or unknown", () => {
  it("names the two islands you are sailing between", () => {
    expect(seaLabel("Loguetown", "Reverse Mountain")).toBe("En el mar, entre Loguetown y Reverse Mountain");
    expect(seaLabel(null, "X")).toBe("En alta mar");
  });
  it("whereLabel picks exactly one of the three cases", () => {
    expect(whereLabel({ hidden: false, kind: "island", islandName: "Marineford" })).toEqual({ name: "Marineford", kind: "island" });
    expect(whereLabel({ hidden: false, kind: "sea", seaFromName: "A", seaToName: "B" })).toEqual({ name: "En el mar, entre A y B", kind: "sea" });
    expect(whereLabel({ hidden: true, kind: "island", islandName: "Marineford" })).toEqual({ name: UNKNOWN_LOCATION, kind: "unknown" });
    expect(whereLabel({ hidden: false, kind: "island", islandName: null })).toEqual({ name: UNKNOWN_LOCATION, kind: "unknown" });
  });
  it("hidden always wins: a secret position is never leaked as an island or as the sea", () => {
    expect(whereLabel({ hidden: true, kind: "sea", seaFromName: "A", seaToName: "B" }).kind).toBe("unknown");
  });
  it("some moves are voyages: pirates sail far more often than Cipher Pol agents", () => {
    let pirate = 0;
    let cp = 0;
    for (let seed = 1; seed <= 800; seed++) {
      pirate += pickMoves(mulberry32(seed), [actor({ id: "p" })], nb).filter((m) => m.viaSea).length;
      cp += pickMoves(mulberry32(seed), [actor({ id: "c", factionType: "CIPHER_POL" })], nb).filter((m) => m.viaSea).length;
    }
    expect(pirate).toBeGreaterThan(0);
    expect(pirate).toBeGreaterThan(cp);
  });
  it("an actor already at sea is never given a second move and never re-placed at home", () => {
    const sailing = actor({ id: "s", currentIslandId: null, locationKind: "sea" });
    for (let seed = 1; seed <= 200; seed++) expect(pickMoves(mulberry32(seed), [sailing], nb)).toEqual([]);
  });
});
