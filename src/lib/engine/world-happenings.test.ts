import { describe, expect, it } from "vitest";
import { HAPPENING_INTERVAL_MS, HAPPENING_SEEDS, fallbackHappening, happeningDue, parseHappening, pickSeeds } from "./world-happenings";
import { varietyRng } from "./rng";

describe("world happenings", () => {
  it("is due when none exists or a full 24 h has passed, not before", () => {
    const now = new Date("2026-01-02T12:00:00Z");
    expect(happeningDue(null, now)).toBe(true);
    expect(happeningDue(new Date(now.getTime() - HAPPENING_INTERVAL_MS + 60_000), now)).toBe(false);
    expect(happeningDue(new Date(now.getTime() - HAPPENING_INTERVAL_MS), now)).toBe(true);
  });

  it("has a wide catalogue of distinct kinds", () => {
    expect(HAPPENING_SEEDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(HAPPENING_SEEDS.map((s) => s.kind)).size).toBe(HAPPENING_SEEDS.length);
  });

  it("picks distinct seeds and skips the recent kinds", () => {
    const picks = pickSeeds(varietyRng("a"), ["festival", "tormenta"], 5);
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((p) => p.kind)).size).toBe(5);
    expect(picks.some((p) => p.kind === "festival" || p.kind === "tormenta")).toBe(false);
  });

  it("parses a valid AI answer and matches the island by name", () => {
    const raw = JSON.stringify({ kind: "Festival", island: "loguetown", headline: "Festival de las mil linternas", body: "x".repeat(80) });
    const h = parseHappening(raw, ["Loguetown", "Alabasta"]);
    expect(h).toMatchObject({ islandName: "Loguetown", kind: "festival" });
  });

  it("rejects unusable answers", () => {
    expect(parseHappening("nope", ["A"])).toBeNull();
    expect(parseHappening(JSON.stringify({ headline: "Titular largo", body: "corto" }), ["A"])).toBeNull();
  });

  it("keeps an unknown island as null and builds an offline fallback", () => {
    const h = parseHappening(JSON.stringify({ island: "Atlantis", headline: "Un titular válido", body: "y".repeat(90) }), ["A"]);
    expect(h?.islandName).toBeNull();
    const f = fallbackHappening(HAPPENING_SEEDS[0], "Loguetown");
    expect(f.body).toContain("Loguetown");
    expect(f.islandName).toBe("Loguetown");
  });
});
