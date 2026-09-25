import { describe, expect, it } from "vitest";
import { parseRefereeVerdict } from "./referee";

const NL = String.fromCharCode(10);
const LONG = "Sebastian se acerca a Leo y le apunta con la katana al cuello para interrogarlo sin bajar la guardia.";

describe("parseRefereeVerdict with messy model output (real failure, 2026-09-25: a round could not be judged)", () => {
  it("accepts raw line breaks inside the strings of a fenced answer", () => {
    const raw = "```json" + NL + '{"resultado": "' + LONG + NL + NL + 'Barbosa vigila el callejón.", "reaccion_rival": "Leo tiembla.", "cambios": [{"nombre":"Leo","vida":5,"aguante":2}]}' + NL + "```";
    const v = parseRefereeVerdict(raw);
    expect(v).not.toBeNull();
    expect(v!.narration).toContain("Barbosa vigila el callejón.");
    expect(v!.changes[0]).toMatchObject({ name: "Leo", hp: 5 });
  });
  it("reads a text field given as an object with one entry per fighter", () => {
    const raw = JSON.stringify({ resultado: { Sebastian: LONG, Barbosa: "Barbosa patea el cuchillo lejos del alcance de Leo." }, cambios: [] });
    const v = parseRefereeVerdict(raw);
    expect(v).not.toBeNull();
    expect(v!.narration).toContain("Sebastian se acerca");
    expect(v!.narration).toContain("Barbosa patea");
  });
  it("still rejects an answer with no usable result", () => {
    expect(parseRefereeVerdict('{"resultado": "corto"}')).toBeNull();
    expect(parseRefereeVerdict("no json here")).toBeNull();
  });
});
