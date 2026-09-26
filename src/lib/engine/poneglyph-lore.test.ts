import { describe, expect, it } from "vitest";
import {
  canReadKind,
  chapterFor,
  HISTORY_CHAPTERS,
  HISTORY_TOTAL,
  raidHistoryFactor,
  routeSteps,
  rubbingName,
  scriptAfterStudy,
  scriptLabel,
  scriptNeeded,
  SCRIPT_FOR_ROAD,
  STUDY_COOLDOWN_MS,
  studyBlockReason,
} from "./poneglyph-lore";

const now = new Date("2026-09-26T12:00:00Z");

describe("the ancient script", () => {
  it("Historia stones need less than Road stones", () => {
    expect(scriptNeeded("Historia")).toBeLessThan(scriptNeeded("Road"));
    expect(canReadKind("Historia", 25)).toBe(true);
    expect(canReadKind("Road", 25)).toBe(false);
    expect(canReadKind("Road", SCRIPT_FOR_ROAD)).toBe(true);
  });
  it("study only in Ohara, with rest in between and some stamina", () => {
    const ok = { islandName: "Ohara", script: 0, lastStudyAt: null, stamina: 100, now };
    expect(studyBlockReason(ok)).toBeNull();
    expect(studyBlockReason({ ...ok, islandName: "Alabasta" })).toContain("Ohara");
    expect(studyBlockReason({ ...ok, lastStudyAt: new Date(now.getTime() - 60_000) })).toContain("min");
    expect(studyBlockReason({ ...ok, lastStudyAt: new Date(now.getTime() - STUDY_COOLDOWN_MS) })).toBeNull();
    expect(studyBlockReason({ ...ok, stamina: 5 })).toContain("agotado");
    expect(studyBlockReason({ ...ok, script: 100 })).toContain("dominas");
  });
  it("two sessions to read the history, two more for the road, capped", () => {
    expect(scriptAfterStudy(0)).toBe(25);
    expect(scriptAfterStudy(scriptAfterStudy(25))).toBe(75);
    expect(scriptAfterStudy(90)).toBe(100);
  });
  it("labels every level", () => {
    expect(scriptLabel(0)).toContain("No sabes");
    expect(scriptLabel(30)).toContain("Historia");
    expect(scriptLabel(60)).toContain("Ruta");
    expect(scriptLabel(100)).toContain("Erudito");
  });
});

describe("the history of the forgotten century", () => {
  it("has one chapter per island, each with a unique stone", () => {
    expect(new Set(HISTORY_CHAPTERS.map((c) => c.codeName)).size).toBe(HISTORY_TOTAL);
    expect(new Set(HISTORY_CHAPTERS.map((c) => c.islandName)).size).toBe(HISTORY_TOTAL);
    expect(chapterFor(HISTORY_CHAPTERS[2].codeName)?.key).toBe("gyojin");
    expect(chapterFor("nope")).toBeNull();
  });
  it("the last chapter names the Empty Throne the truth of Laugh Tale speaks of", () => {
    expect(HISTORY_CHAPTERS[HISTORY_TOTAL - 1].text).toContain("Trono Vacío");
  });
  it("every chapter read by the coalition weakens the ruler a little, capped", () => {
    expect(raidHistoryFactor(0)).toBe(1);
    expect(raidHistoryFactor(3)).toBeCloseTo(0.91);
    expect(raidHistoryFactor(99)).toBeCloseTo(1 - 0.03 * HISTORY_TOTAL);
  });
  it("names rubbings after their stone", () => {
    expect(rubbingName("Poneglifo X")).toBe("Calco: Poneglifo X");
  });
});

describe("the route", () => {
  it("is a checklist that fills in", () => {
    const empty = routeSteps({ script: 0, historyRead: 0, roadRead: 0, roadTotal: 4, rubbings: 0, knowsTruth: false });
    expect(empty.every((s) => !s.done)).toBe(true);
    const done = routeSteps({ script: 60, historyRead: HISTORY_TOTAL, roadRead: 4, roadTotal: 4, rubbings: 1, knowsTruth: true });
    expect(done.filter((s) => s.done).map((s) => s.id)).toEqual(["script", "history", "road", "laughtale"]);
    expect(done.find((s) => s.id === "road")?.detail).toContain("calco");
  });
});
