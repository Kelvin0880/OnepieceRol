import { describe, it, expect } from "vitest";
import { isAdminUsername, isAdminLookalike } from "./admin";

describe("isAdminUsername", () => {
  it("matches the listed names exactly, ignoring surrounding spaces", () => {
    expect(isAdminUsername("Kelvin", "Kelvin, Otro")).toBe(true);
    expect(isAdminUsername("Otro", "Kelvin, Otro")).toBe(true);
    expect(isAdminUsername(" Kelvin ", "Kelvin")).toBe(true);
  });
  it("is case-sensitive so a lookalike account never inherits owner powers", () => {
    expect(isAdminUsername("kelvin", "Kelvin")).toBe(false);
    expect(isAdminUsername("KELVIN", "Kelvin")).toBe(false);
  });
  it("nobody is admin when the variable is missing or empty", () => {
    expect(isAdminUsername("Kelvin", undefined)).toBe(false);
    expect(isAdminUsername("Kelvin", "")).toBe(false);
    expect(isAdminUsername("Kelvin", " , ")).toBe(false);
  });
  it("does not match partial names", () => {
    expect(isAdminUsername("Kel", "Kelvin")).toBe(false);
    expect(isAdminUsername("Kelvin2", "Kelvin")).toBe(false);
  });
});

describe("isAdminLookalike", () => {
  it("flags names that differ from an admin name only by case", () => {
    expect(isAdminLookalike("kelvin", "Kelvin")).toBe(true);
    expect(isAdminLookalike("KELVIN", "Kelvin")).toBe(true);
  });
  it("does not flag the exact admin name, other names, or when nothing is configured", () => {
    expect(isAdminLookalike("Kelvin", "Kelvin")).toBe(false);
    expect(isAdminLookalike("Pedro", "Kelvin")).toBe(false);
    expect(isAdminLookalike("kelvin", undefined)).toBe(false);
  });
});
