import { describe, expect, it } from "vitest";
import { pathSteps, type PathInput } from "./path-guide";

const base: PathInput = {
  faction: "MARINE", level: 5, imprisoned: false, hp: 100, maxHp: 100, hasCrew: false, canHaveCrew: true,
  rankTitle: "Cabo", nextRankTitle: "Sargento", rankRemaining: 200, rankMetric: "Mérito", seatTitle: null, nextSeat: null,
  pendingSeatChallenges: 0, activeMissions: 3, factionContractActive: true, attributePoints: 0, roadRead: 0, historyRead: 0,
  script: 0, rubbings: 0, isEmperor: false, isWarlord: false, bounty: 0, openWorldWars: [], openEvents: 0,
};

describe("Mi camino", () => {
  it("tells a Shichibukai the Government is calling", () => {
    const s = pathSteps({ ...base, faction: "PIRATE", isWarlord: true, openWorldWars: [{ label: "Un Emperador contra la Marina", mySide: false, canEnlist: true, governmentCall: true }] });
    expect(s.find((x) => x.id.startsWith("war-"))?.title).toContain("Gobierno te llama");
  });
  it("a new marine is told to do the island's jobs and how to climb", () => {
    const s = pathSteps(base);
    expect(s[0].id).toBe("missions");
    expect(s.find((x) => x.id === "rank")?.detail).toContain("Arresta");
    expect(s.some((x) => x.id === "crew")).toBe(true);
  });
  it("urgent things come first: prison, a seat challenge, being badly hurt", () => {
    const s = pathSteps({ ...base, imprisoned: true, pendingSeatChallenges: 1, hp: 10 });
    expect(s.slice(0, 2).map((x) => x.id)).toEqual(["prison", "seat-defense"]);
    expect(s.some((x) => x.id === "heal")).toBe(false);
  });
  it("points at the next seat and says what is missing", () => {
    const s = pathSteps({ ...base, nextSeat: { title: "Almirante", ok: false, missing: ["Nivel 40"] } });
    expect(s.find((x) => x.id === "seat")?.detail).toContain("Nivel 40");
    const ready = pathSteps({ ...base, nextSeat: { title: "Almirante", ok: true, missing: [] } });
    expect(ready.find((x) => x.id === "seat")?.title).toContain("Desafía");
  });
  it("a seat holder is told to defend it", () => {
    expect(pathSteps({ ...base, seatTitle: "Almirante de Flota" }).some((x) => x.id === "seat-hold")).toBe(true);
  });
  it("pirates see the Warlord/Emperor path and hunters never get a crew step", () => {
    expect(pathSteps({ ...base, faction: "PIRATE", level: 20, bounty: 150_000_000 }).some((x) => x.id === "warlord")).toBe(true);
    expect(pathSteps({ ...base, faction: "BOUNTY_HUNTER", canHaveCrew: false }).some((x) => x.id === "crew")).toBe(false);
  });
  it("the Poneglyph road opens mid-game and rubbings are always mentioned", () => {
    expect(pathSteps(base).some((x) => x.id === "poneglyphs")).toBe(false);
    expect(pathSteps({ ...base, level: 14 }).find((x) => x.id === "poneglyphs")?.title).toContain("Ohara");
    expect(pathSteps({ ...base, rubbings: 2 }).some((x) => x.id === "rubbings")).toBe(true);
  });
  it("offers running wars and never lists more than seven steps", () => {
    const s = pathSteps({ ...base, attributePoints: 3, openEvents: 2, level: 14, rubbings: 1, openWorldWars: [{ label: "La Revolución contra el Gobierno Mundial", mySide: true, canEnlist: false }] });
    expect(s.length).toBeLessThanOrEqual(7);
    expect(s.some((x) => x.id.startsWith("war-"))).toBe(true);
  });
  it("with nothing left here it suggests exploring or sailing", () => {
    expect(pathSteps({ ...base, activeMissions: 0 }).some((x) => x.id === "explore")).toBe(true);
  });
});
