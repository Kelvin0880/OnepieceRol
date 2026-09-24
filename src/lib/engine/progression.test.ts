import { describe, it, expect } from "vitest";
import {
  pirateBountyTitle,
  marineRankTitle,
  revolutionaryTitle,
  bountyHunterTitle,
  factionTitle,
  crossedPirateTier,
  crossedMarineTier,
  rankProgress,
  UNPOSTED_TITLE,
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
        UNPOSTED_TITLE,
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
    expect(pirateBountyTitle(999_999)).toBe(UNPOSTED_TITLE); // has a bounty, the poster is just not printed yet
    expect(pirateBountyTitle(0)).toBe("Sin recompensa");
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
    expect(factionTitle("CP0", 999_999_999, 280)).toBe("Agente CP8"); // bounty ignored for Cipher Pol
    expect(factionTitle("CP0", 0, 0)).toBe("Aspirante");
    expect(factionTitle("CP0", 0, 50_000)).toBe("Gorosei"); // caps at the top tier
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

describe("rankProgress", () => {
  it("a pirate with a small bounty is not 'without bounty' and sees the road to the first poster", () => {
    expect(pirateBountyTitle(1050)).toBe(UNPOSTED_TITLE);
    expect(pirateBountyTitle(0)).toBe("Sin recompensa");
    const p = rankProgress("PIRATE", 1050, 0);
    expect(p.title).toBe(UNPOSTED_TITLE);
    expect(p.nextTitle).toBe("Novato de la Grand Line");
    expect(p.target).toBe(1_000_000);
    expect(p.remaining).toBe(1_000_000 - 1050);
    expect(p.fraction).toBeGreaterThan(0);
    expect(p.fraction).toBeLessThan(0.01);
  });
  it("progress is measured inside the current tier and matches the tier the news would announce", () => {
    const p = rankProgress("PIRATE", 5_500_000, 0);
    expect(p.title).toBe("Novato de la Grand Line");
    expect(p.floor).toBe(1_000_000);
    expect(p.target).toBe(10_000_000);
    expect(p.fraction).toBeCloseTo((5_500_000 - 1_000_000) / 9_000_000, 5);
    expect(crossedPirateTier(9_999_999, 10_000_000)?.title).toBe(p.nextTitle);
  });
  it("non-pirate factions read notoriety, with their own labels", () => {
    const m = rankProgress("MARINE", 999_999_999, 120);
    expect(m.title).toBe("Marine Raso");
    expect(m.nextTitle).toBe("Cabo");
    expect(m.remaining).toBe(30);
    expect(m.metric).toBe("Mérito");
    expect(rankProgress("CP0", 0, 0).metric).toBe("Confianza del Gobierno");
    expect(rankProgress("BOUNTY_HUNTER", 0, 10).nextTitle).toBe("Cazador de gremio");
  });
  it("at the top of the ladder there is nothing left to climb", () => {
    const top = rankProgress("PIRATE", 6_000_000_000, 0);
    expect(top.nextTitle).toBeNull();
    expect(top.target).toBeNull();
    expect(top.remaining).toBeNull();
    expect(top.fraction).toBe(1);
  });
  it("never yields a fraction outside 0..1, even with odd input", () => {
    for (const v of [-50, 0, 1, 49, 50, 51, 99_999_999_999]) {
      const p = rankProgress("MARINE", 0, v);
      expect(p.fraction).toBeGreaterThanOrEqual(0);
      expect(p.fraction).toBeLessThanOrEqual(1);
    }
  });
});
