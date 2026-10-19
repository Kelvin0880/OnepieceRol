import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { blockedWhilePaused, shiftDate, PAUSE_SHIFT, PAUSE_IGNORE } from "./pause";

describe("blockedWhilePaused", () => {
  it("refuses every write, so nobody can act while paused", () => {
    expect(blockedWhilePaused("POST", "/api/auth/register")).toBe(true);
    expect(blockedWhilePaused("POST", "/api/characters")).toBe(true);
    expect(blockedWhilePaused("DELETE", "/api/characters/abc")).toBe(true);
    expect(blockedWhilePaused("POST", "/api/tts")).toBe(true);
    expect(blockedWhilePaused("POST", "/api/admin/tools")).toBe(true);
  });

  it("refuses reading a character, because that runs the lazy world logic", () => {
    expect(blockedWhilePaused("GET", "/api/characters/abc")).toBe(true);
    expect(blockedWhilePaused("GET", "/api/characters/abc/stream")).toBe(true);
    expect(blockedWhilePaused("GET", "/api/characters/abc/coliseum")).toBe(true);
  });

  it("keeps the public pages readable", () => {
    for (const p of ["/api/news", "/api/codex", "/api/codex/players", "/api/codex/residents", "/api/world-events", "/api/me", "/api/characters", "/api/ping", "/api/pause", "/api/crews/abc/emblem"]) {
      expect(blockedWhilePaused("GET", p)).toBe(false);
    }
    expect(blockedWhilePaused("GET", "/api/characters/abc/portrait")).toBe(false);
  });

  it("still lets people log in and out", () => {
    expect(blockedWhilePaused("POST", "/api/auth/login")).toBe(false);
    expect(blockedWhilePaused("POST", "/api/auth/logout")).toBe(false);
  });
});

describe("shiftDate", () => {
  it("moves a date forward by the paused time", () => {
    expect(shiftDate(new Date("2026-01-01T00:00:00Z"), 3_600_000).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
});

describe("PAUSE_SHIFT covers the schema", () => {
  const lines = readFileSync(path.resolve(__dirname, "../../../prisma/schema.prisma"), "utf8").split(/\r?\n/);
  const schema = new Map<string, Set<string>>();
  const dateColumns: string[] = [];
  let model = "";
  for (const line of lines) {
    const m = line.match(/^model (\w+)/);
    if (m) {
      model = m[1];
      schema.set(model, new Set());
    }
    const f = line.match(/^\s+(\w+)\s+DateTime\b/);
    if (f && model) {
      schema.get(model)!.add(f[1]);
      if (f[1] !== "createdAt" && f[1] !== "updatedAt") dateColumns.push(`${model}.${f[1]}`);
    }
  }
  const shifted = PAUSE_SHIFT.flatMap((r) => r.columns.map((c) => `${r.model}.${c}`));

  it("every date column is either shifted or deliberately ignored", () => {
    const decided = new Set([...shifted, ...PAUSE_IGNORE]);
    expect(dateColumns.filter((c) => !decided.has(c))).toEqual([]);
  });

  it("never shifts and ignores the same column", () => {
    expect(shifted.filter((c) => PAUSE_IGNORE.includes(c))).toEqual([]);
  });

  it("only names models and columns that exist", () => {
    expect(shifted.filter((c) => !schema.get(c.split(".")[0])?.has(c.split(".")[1]))).toEqual([]);
    expect(PAUSE_IGNORE.filter((c) => !schema.get(c.split(".")[0])?.has(c.split(".")[1]))).toEqual([]);
  });
});
