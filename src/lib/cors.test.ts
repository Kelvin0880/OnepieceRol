import { describe, expect, it } from "vitest";
import { LANDING_ORIGIN, pingCorsOrigin } from "./cors";

describe("pingCorsOrigin", () => {
  it("lets the GitHub Pages landing read the ping in every environment", () => {
    expect(pingCorsOrigin(LANDING_ORIGIN, true)).toBe(LANDING_ORIGIN);
    expect(pingCorsOrigin(LANDING_ORIGIN, false)).toBe(LANDING_ORIGIN);
  });

  it("allows local previews only outside production", () => {
    expect(pingCorsOrigin("http://localhost:4600", false)).toBe("http://localhost:4600");
    expect(pingCorsOrigin("http://127.0.0.1:5173", false)).toBe("http://127.0.0.1:5173");
    expect(pingCorsOrigin("http://localhost:4600", true)).toBeNull();
  });

  it("refuses anyone else and lookalikes", () => {
    expect(pingCorsOrigin(null, true)).toBeNull();
    expect(pingCorsOrigin("https://evil.example", false)).toBeNull();
    expect(pingCorsOrigin("https://kelvin0880.github.io.evil.example", true)).toBeNull();
    expect(pingCorsOrigin("http://localhost.evil.example", false)).toBeNull();
  });
});
