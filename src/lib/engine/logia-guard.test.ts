import { describe, expect, it } from "vitest";
import { logiaImmuneTo, logiaShieldedFrom } from "./logia-guard";

const rookie = { armamentHaki: 0, observationHaki: 0, conqueror: false, abilities: ["puñetazos"] };

describe("logiaImmuneTo", () => {
  it("a plain brawler with no Haki, fruit or seastone cannot hurt a Logia", () => {
    expect(logiaImmuneTo(rookie)).toBe(true);
    expect(logiaImmuneTo({ ...rookie, weapon: "Espada de acero" })).toBe(true);
  });
  it("Armament Haki or Conqueror's Haki gets through", () => {
    expect(logiaImmuneTo({ ...rookie, armamentHaki: 1 })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, conqueror: true })).toBe(false);
  });
  it("any devil fruit gets through: same element cannot be ruled out, so the guard stays out of the way", () => {
    expect(logiaImmuneTo({ ...rookie, fruit: { name: "Gomu Gomu no Mi", phase: "initial" } })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, secondFruit: { name: "Gura Gura no Mi", phase: "initial" } })).toBe(false);
  });
  it("seastone gets through, in the weapon or in a signature move, in Spanish or English", () => {
    expect(logiaImmuneTo({ ...rookie, weapon: "Porra de Kairoseki" })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, abilities: ["red de piedra marina"] })).toBe(false);
    expect(logiaImmuneTo({ ...rookie, abilities: ["seastone cuffs"] })).toBe(false);
  });
});

describe("logiaShieldedFrom", () => {
  it("needs both a Logia fruit and a rival that cannot hurt it", () => {
    expect(logiaShieldedFrom("LOGIA", rookie)).toBe(true);
    expect(logiaShieldedFrom("PARAMECIA", rookie)).toBe(false);
    expect(logiaShieldedFrom(undefined, rookie)).toBe(false);
    expect(logiaShieldedFrom("LOGIA", { ...rookie, armamentHaki: 5 })).toBe(false);
  });
});
