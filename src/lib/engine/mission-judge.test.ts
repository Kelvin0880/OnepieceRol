import { describe, expect, it } from "vitest";
import { judgeableKinds, parseMissionVerdict } from "./mission-judge";

describe("parseMissionVerdict", () => {
  it("reads advances and hints, drops unknown ids and duplicates", () => {
    const raw = 'Claro: {"misiones":[{"id":"a","avanza":true,"pista":"Quemó el almacén"},{"id":"zzz","avanza":true},{"id":"a","avanza":false},{"id":"b","avanza":"no"}]}';
    const v = parseMissionVerdict(raw, ["a", "b"]);
    expect(v).toEqual([{ id: "a", advance: true, hint: "Quemó el almacén" }, { id: "b", advance: false, hint: undefined }]);
  });
  it("rejects garbage", () => {
    expect(parseMissionVerdict("nada", ["a"])).toBeNull();
    expect(parseMissionVerdict('{"otra":1}', ["a"])).toBeNull();
  });
  it("judges story goals only; explore only for pure roleplay turns", () => {
    expect(judgeableKinds(false)).toEqual(["win_fights", "spare"]);
    expect(judgeableKinds(true)).toContain("explore");
    expect(judgeableKinds(true)).not.toContain("train");
  });
});
