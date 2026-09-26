import { describe, expect, it } from "vitest";
import { islandLoreBlock, parseIslandLore, placeNames } from "./island-lore";

const raw = JSON.stringify({
  atmosphere: "Olor a sal y a pan recién hecho.",
  history: "Un pueblo de pescadores que vio zarpar a un futuro Rey Pirata.",
  customs: ["Se brinda por los que zarpan"],
  places: [
    { name: "Bar de la Colina", kind: "taberna", description: "La taberna del pueblo.", regulars: ["Nora", "Fulano Inventado"] },
    { name: "Muelle Viejo", kind: "puerto", description: "Barcas de pesca." },
    { name: "Molino", kind: "edificio", description: "Un molino junto al trigal." },
    { name: "Plaza del Pozo", kind: "plaza", description: "El centro del pueblo." },
    { name: "Muelle viejo", kind: "puerto", description: "Duplicado." },
  ],
  rumors: ["Dicen que hay un cofre bajo el molino"],
});

describe("island lore", () => {
  it("parses places, drops duplicates and regulars that are not real residents", () => {
    const lore = parseIslandLore(raw, "Pueblo Foosha", ["Nora"])!;
    expect(lore.places).toHaveLength(4);
    expect(lore.places[0].regulars).toEqual(["Nora"]);
    expect(placeNames(lore)).toContain("Molino");
  });
  it("rejects a thin or broken gazetteer", () => {
    expect(parseIslandLore("{}", "X", [])).toBeNull();
    expect(parseIslandLore("nada", "X", [])).toBeNull();
    expect(parseIslandLore(JSON.stringify({ history: "a", places: [{ name: "A", description: "b" }] }), "X", [])).toBeNull();
  });
  it("the narrator block carries the lore, the places and every active mission in full", () => {
    const lore = parseIslandLore(raw, "Pueblo Foosha", ["Nora"]);
    const b = islandLoreBlock({
      name: "Pueblo Foosha",
      description: "Un pueblo tranquilo del East Blue.",
      arcHook: "Unos matones cobran protección.",
      danger: 1,
      control: null,
      lore,
      missions: [{ title: "La amenaza", brief: "Derrota a Dirk en el muelle.", progress: 1, target: 2, giver: "Nora", targetName: "Dirk" }],
    });
    expect(b).toContain("GUÍA DE PUEBLO FOOSHA");
    expect(b).toContain("Unos matones cobran protección");
    expect(b).toContain("Bar de la Colina");
    expect(b).toContain("Suele estar: Nora");
    expect(b).toContain("Derrota a Dirk en el muelle");
    expect(b).toContain("objetivo: Dirk");
    expect(b).toContain("NUNCA anuncies una misión completada");
  });
  it("works without a gazetteer yet (description and conflict still go in)", () => {
    const b = islandLoreBlock({ name: "Isla X", description: "Rocas.", arcHook: null, danger: 3, control: "Marina", lore: null, missions: [] });
    expect(b).toContain("Rocas.");
    expect(b).toContain("la controla Marina");
  });
});
