import { describe, it, expect } from "vitest";
import {
  pirateBountyTitle,
  marineRankTitle,
  revolutionaryTitle,
  bountyHunterTitle,
  factionTitle,
  crossedPirateTier,
  crossedMarineTier,
} from "./progression";

describe("pirateBountyTitle", () => {
  it("starts at the zero tier", () => {
    expect(pirateBountyTitle(0)).toBe("Sin recompensa");
  });

  it("never regresses for higher bounty values", () => {
    const samples = [0, 500, 1_000_000, 50_000_000, 999_999_999, 5_000_000_000];
    let lastIndex = -1;
    for (const bounty of samples) {
      const title = pirateBountyTitle(bounty);
      // Re-deriving index by scanning is fine here: just assert monotonic non-decrease in rank ordinal.
      const ordinal = [
        "Sin recompensa",
        "Novato de la Grand Line",
        "Pirata de interés",
        "Superrookie",
        "Amenaza reconocida",
        "Objetivo prioritario",
        "Candidato a Shichibukai",
        "Rango de Emperador",
        "Leyenda viviente",
        "Rey Pirata en ciernes",
      ].indexOf(title);
      expect(ordinal).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = ordinal;
    }
  });

  it("exact threshold values land on the new tier, not the previous one", () => {
    expect(pirateBountyTitle(1_000_000)).toBe("Novato de la Grand Line");
    expect(pirateBountyTitle(999_999)).toBe("Sin recompensa");
  });
});

describe("marineRankTitle / revolutionaryTitle / bountyHunterTitle", () => {
  it("all start at their respective base rank at 0 points", () => {
    expect(marineRankTitle(0)).toBe("Recluta");
    expect(revolutionaryTitle(0)).toBe("Simpatizante");
    expect(bountyHunterTitle(0)).toBe("Cazador novato");
  });

  it("climb with merit points", () => {
    expect(marineRankTitle(12_000)).toBe("Almirante");
    expect(marineRankTitle(20_000)).toBe("Almirante"); // caps at top tier, doesn't error past it
  });
});

describe("factionTitle", () => {
  it("routes PIRATE through bounty, everyone else through notoriety", () => {
    expect(factionTitle("PIRATE", 1_000_000, 0)).toBe("Novato de la Grand Line");
    expect(factionTitle("MARINE", 999_999_999, 50)).toBe("Marine Raso"); // bounty ignored for marines
    expect(factionTitle("REVOLUTIONARY", 0, 150)).toBe("Agente de campo");
    expect(factionTitle("BOUNTY_HUNTER", 0, 350)).toBe("Verdugo independiente");
  });
});

describe("crossedPirateTier / crossedMarineTier", () => {
  it("detects a tier crossed within a delta", () => {
    const crossed = crossedPirateTier(900_000, 1_200_000);
    expect(crossed?.title).toBe("Novato de la Grand Line");
  });

  it("returns null when no tier boundary was crossed", () => {
    expect(crossedPirateTier(1_100_000, 1_200_000)).toBeNull();
  });

  it("returns the lowest newly-crossed tier when a delta jumps multiple tiers", () => {
    // Jumping from 0 straight past several thresholds should report the first one crossed.
    const crossed = crossedMarineTier(0, 100_000);
    expect(crossed?.title).toBe("Marine Raso");
  });

  it("does not report a crossing when moving backward", () => {
    expect(crossedPirateTier(5_000_000, 1_000_000)).toBeNull();
  });
});
