import { describe, expect, it } from "vitest";
import { admiralOpening, dispatchPhase, dispatchTravelMs, isDispatchTarget, islandProtectedFromDispatch, pickDispatchTarget, shouldStartDispatch } from "./admiral-dispatch";

const isl = (name: string, over: Partial<Parameters<typeof islandProtectedFromDispatch>[0]> = {}) => ({ name, factionControl: null, ownerFaction: null, ownedByPlayer: false, ...over });

describe("which islands the Government never attacks", () => {
  it("protects starter, revolutionary and pirate islands", () => {
    for (const n of ["Pueblo Foosha", "Cuartel Marine G-5", "Isla Baltigo", "Isla Gecko", "Tequila Wolf"]) expect(islandProtectedFromDispatch(isl(n))).toBe(true);
    expect(islandProtectedFromDispatch(isl("Reino Kamabakka", { factionControl: "Ejército Revolucionario" }))).toBe(true);
    expect(islandProtectedFromDispatch(isl("Hachinosu", { factionControl: "Piratas de Barbanegra" }))).toBe(true);
    expect(islandProtectedFromDispatch(isl("Alabasta", { ownerFaction: "PIRATE" }))).toBe(true);
    expect(islandProtectedFromDispatch(isl("Isla del Toro Negro", { ownedByPlayer: true }))).toBe(true);
  });
  it("allows ordinary islands", () => {
    expect(islandProtectedFromDispatch(isl("Jaya", { factionControl: "Sin gobierno (Ciudad Mock y Ciudad Ley)" }))).toBe(false);
    expect(islandProtectedFromDispatch(isl("Loguetown", { factionControl: "Marina" }))).toBe(false);
  });
});

describe("who is hunted and when", () => {
  it("only living pirate players of level 2+", () => {
    expect(isDispatchTarget({ faction: "PIRATE", level: 2, status: "ALIVE" })).toBe(true);
    expect(isDispatchTarget({ faction: "PIRATE", level: 1, status: "ALIVE" })).toBe(false);
    expect(isDispatchTarget({ faction: "MARINE", level: 30, status: "ALIVE" })).toBe(false);
    expect(isDispatchTarget({ faction: "PIRATE", level: 9, status: "IMPRISONED" })).toBe(false);
  });
  it("is rare: never while open, never inside the cooldown", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    expect(shouldStartDispatch(() => 0, { hasOpen: true, lastEndedAt: null, now })).toBe(false);
    expect(shouldStartDispatch(() => 0, { hasOpen: false, lastEndedAt: new Date(now.getTime() - 3600_000), now })).toBe(false);
    expect(shouldStartDispatch(() => 0, { hasOpen: false, lastEndedAt: null, now })).toBe(true);
    expect(shouldStartDispatch(() => 0.5, { hasOpen: false, lastEndedAt: null, now })).toBe(false);
  });
  it("picks only islands with targets, weighted by headcount", () => {
    expect(pickDispatchTarget(() => 0.1, [{ id: "a", targets: 0 }])).toBeNull();
    expect(pickDispatchTarget(() => 0.99, [{ id: "a", targets: 1 }, { id: "b", targets: 3 }])).toBe("b");
    expect(pickDispatchTarget(() => 0.0, [{ id: "a", targets: 1 }, { id: "b", targets: 3 }])).toBe("a");
  });
});

describe("the crossing and the clock", () => {
  it("takes 20 to 60 minutes", () => {
    expect(dispatchTravelMs(0)).toBe(20 * 60_000);
    expect(dispatchTravelMs(4)).toBe(32 * 60_000);
    expect(dispatchTravelMs(40)).toBe(60 * 60_000);
  });
  it("arrives on time, and sails home on time", () => {
    const t = new Date("2026-09-26T12:00:00Z");
    const before = new Date(t.getTime() - 1000);
    const after = new Date(t.getTime() + 1000);
    expect(dispatchPhase({ status: "EN_ROUTE", arrivesAt: t, returnsAt: null }, before)).toBe("wait");
    expect(dispatchPhase({ status: "EN_ROUTE", arrivesAt: t, returnsAt: null }, after)).toBe("arrive");
    expect(dispatchPhase({ status: "RETURNING", arrivesAt: t, returnsAt: t }, after)).toBe("home");
    expect(dispatchPhase({ status: "ARRIVED", arrivesAt: t, returnsAt: null }, after)).toBe("wait");
  });
  it("opens with the admiral's announced attack and the turn order", () => {
    const t = admiralOpening("Akainu", "Jaya", "Meigo");
    expect(t).toContain("Akainu");
    expect(t).toContain("TODAS las acciones");
  });
});
