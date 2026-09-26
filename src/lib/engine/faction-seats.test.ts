import { describe, expect, it } from "vitest";
import {
  CANON_SEATS,
  isEntryAspirant,
  isRevolutionBase,
  isSeatId,
  ladderFor,
  pickBySeed,
  seatAbove,
  seatChallengeBlock,
  SEAT_CHALLENGE_COOLDOWN_MS,
  seatHolderStats,
  seatRank,
  seatRequirements,
  seatSwap,
  SEATS,
  seatWarBlockReason,
  seatWarKind,
  type ChallengeBlockInput,
  type SeatCandidate,
} from "./faction-seats";
import { actorCombatStats } from "./guardian";

const now = new Date("2026-09-26T12:00:00Z");
const marine: SeatCandidate = { faction: "MARINE", alive: true, imprisoned: false, level: 45, merit: 8_000, seat: null };

describe("ladders", () => {
  it("orders every faction's seats bottom to top", () => {
    expect(ladderFor("MARINE").map((s) => s.id)).toEqual(["ADMIRAL", "FLEET_ADMIRAL"]);
    expect(ladderFor("REVOLUTIONARY").map((s) => s.id)).toEqual(["REV_COMMANDER", "REV_CHIEF", "REV_LEADER"]);
    expect(ladderFor("CP0").map((s) => s.id)).toEqual(["GOROSEI"]);
  });
  it("gives bounty hunters and pirates no seats", () => {
    expect(ladderFor("BOUNTY_HUNTER")).toEqual([]);
    expect(ladderFor("PIRATE")).toEqual([]);
  });
  it("there is exactly one fleet admiral, one revolutionary leader and five elders", () => {
    expect(SEATS.FLEET_ADMIRAL.seats).toBe(1);
    expect(SEATS.REV_LEADER.seats).toBe(1);
    expect(SEATS.GOROSEI.seats).toBe(5);
    expect(SEATS.ADMIRAL.seats).toBe(3);
  });
  it("knows the seat above and the rank inside the ladder", () => {
    expect(seatAbove("ADMIRAL")?.id).toBe("FLEET_ADMIRAL");
    expect(seatAbove("FLEET_ADMIRAL")).toBeNull();
    expect(seatRank(null)).toBe(-1);
    expect(seatRank("REV_LEADER")).toBe(2);
    expect(isSeatId("GOROSEI")).toBe(true);
    expect(isSeatId("YONKO")).toBe(false);
  });
  it("the canon seats fill the ladders without overflowing them", () => {
    const count = (id: string) => Object.values(CANON_SEATS).filter((s) => s === id).length;
    for (const s of Object.values(SEATS)) expect(count(s.id)).toBe(s.seats);
  });
});

describe("requirements", () => {
  it("accepts a marine with the level and merit for admiral", () => {
    expect(seatRequirements("ADMIRAL", marine).ok).toBe(true);
  });
  it("refuses another faction", () => {
    const r = seatRequirements("ADMIRAL", { ...marine, faction: "PIRATE" });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "faction")?.met).toBe(false);
  });
  it("fleet admiral needs to be an admiral first", () => {
    const strong = { ...marine, level: 60, merit: 20_000 };
    expect(seatRequirements("FLEET_ADMIRAL", strong).ok).toBe(false);
    expect(seatRequirements("FLEET_ADMIRAL", { ...strong, seat: "ADMIRAL" }).ok).toBe(true);
  });
  it("nobody challenges for the seat they already hold, nor a lower entry seat", () => {
    expect(seatRequirements("ADMIRAL", { ...marine, seat: "ADMIRAL" }).ok).toBe(false);
    expect(seatRequirements("ADMIRAL", { ...marine, seat: "FLEET_ADMIRAL" }).ok).toBe(false);
  });
  it("a prisoner cannot challenge", () => {
    expect(seatRequirements("GOROSEI", { faction: "CP0", alive: true, imprisoned: true, level: 60, merit: 9_000, seat: null }).ok).toBe(false);
  });
  it("lists what is missing", () => {
    const r = seatRequirements("REV_LEADER", { faction: "REVOLUTIONARY", alive: true, imprisoned: false, level: 10, merit: 10, seat: null });
    expect(r.checks.filter((c) => !c.met).map((c) => c.id)).toEqual(["level", "merit", "below"]);
  });
});

describe("challenge block", () => {
  const ok: ChallengeBlockInput = { eligible: true, targetHoldsSeat: true, targetIsSelf: false, sameIsland: true, atHq: false, lastChallengeAt: null, targetBusy: false, hasOpenChallenge: false, now };
  it("allows a clean challenge on the same island or at headquarters", () => {
    expect(seatChallengeBlock(ok, "ADMIRAL")).toBeNull();
    expect(seatChallengeBlock({ ...ok, sameIsland: false, atHq: true }, "ADMIRAL")).toBeNull();
  });
  it("tells where to go when far away", () => {
    expect(seatChallengeBlock({ ...ok, sameIsland: false }, "GOROSEI")).toContain("Mary Geoise");
  });
  it("respects the cooldown", () => {
    expect(seatChallengeBlock({ ...ok, lastChallengeAt: new Date(now.getTime() - 3600_000) }, "ADMIRAL")).toContain("espera");
    expect(seatChallengeBlock({ ...ok, lastChallengeAt: new Date(now.getTime() - SEAT_CHALLENGE_COOLDOWN_MS - 1) }, "ADMIRAL")).toBeNull();
  });
  it("refuses self, ineligible, stale and busy targets", () => {
    expect(seatChallengeBlock({ ...ok, targetIsSelf: true }, "ADMIRAL")).toContain("ti mismo");
    expect(seatChallengeBlock({ ...ok, eligible: false }, "ADMIRAL")).toContain("requisitos");
    expect(seatChallengeBlock({ ...ok, targetHoldsSeat: false }, "ADMIRAL")).toContain("ya no es");
    expect(seatChallengeBlock({ ...ok, targetBusy: true }, "ADMIRAL")).toContain("otro asunto");
    expect(seatChallengeBlock({ ...ok, hasOpenChallenge: true }, "ADMIRAL")).toContain("desafío en marcha");
  });
});

describe("seat swap", () => {
  const player = (seat: null | "ADMIRAL" | "FLEET_ADMIRAL" | "REV_COMMANDER" | "REV_CHIEF") => ({ kind: "player" as const, id: "p", seat });
  const canon = (seat: null | "ADMIRAL" | "FLEET_ADMIRAL" | "REV_CHIEF" | "REV_LEADER" | "GOROSEI") => ({ kind: "canon" as const, id: "c", seat });
  it("beating an admiral makes you admiral and sends them down to vice admiral", () => {
    const [win, lose] = seatSwap("ADMIRAL", player(null), canon("ADMIRAL"), true);
    expect(win).toMatchObject({ seat: "ADMIRAL", title: "Almirante" });
    expect(lose).toMatchObject({ seat: null, title: "Vicealmirante" });
  });
  it("beating the fleet admiral swaps the posts: the old fleet admiral takes your admiral seat", () => {
    const [win, lose] = seatSwap("FLEET_ADMIRAL", player("ADMIRAL"), canon("FLEET_ADMIRAL"), true);
    expect(win).toMatchObject({ who: { kind: "player" }, seat: "FLEET_ADMIRAL", title: "Almirante de Flota" });
    expect(lose).toMatchObject({ who: { kind: "canon" }, seat: "ADMIRAL", title: "Almirante" });
  });
  it("a canon admiral who beats a player fleet admiral swaps with them", () => {
    const [win, lose] = seatSwap("FLEET_ADMIRAL", canon("ADMIRAL"), player("FLEET_ADMIRAL"), true);
    expect(win).toMatchObject({ who: { kind: "canon" }, seat: "FLEET_ADMIRAL" });
    expect(lose).toMatchObject({ who: { kind: "player" }, seat: "ADMIRAL" });
  });
  it("the revolution climbs the same way", () => {
    const [win, lose] = seatSwap("REV_LEADER", player("REV_CHIEF"), canon("REV_LEADER"), true);
    expect(win.seat).toBe("REV_LEADER");
    expect(lose.seat).toBe("REV_CHIEF");
  });
  it("an elder who loses stops being an elder", () => {
    const [, lose] = seatSwap("GOROSEI", player(null), canon("GOROSEI"), true);
    expect(lose).toMatchObject({ seat: null, title: "Ex-Gorosei" });
  });
  it("a defender who wins keeps everything", () => {
    expect(seatSwap("ADMIRAL", player(null), canon("ADMIRAL"), false)).toEqual([]);
  });
});

describe("aspirants, stats and wars", () => {
  const base = { factionType: "MARINE", role: "MARINE_OFFICER", rankLabel: "Vicealmirante (candidata a almirante)", seat: null, status: "ACTIVE" };
  it("vice admirals aspire to admiral; revolutionary commanders without a seat to commander", () => {
    expect(isEntryAspirant("ADMIRAL", base)).toBe(true);
    expect(isEntryAspirant("ADMIRAL", { ...base, rankLabel: "Capitán" })).toBe(false);
    expect(isEntryAspirant("ADMIRAL", { ...base, seat: "ADMIRAL" })).toBe(false);
    expect(isEntryAspirant("REV_COMMANDER", { factionType: "REVOLUTIONARY", role: "REVOLUTIONARY_COMMANDER", rankLabel: null, seat: null, status: "ACTIVE" })).toBe(true);
    expect(isEntryAspirant("GOROSEI", { factionType: "CIPHER_POL", role: "CIPHER_POL", rankLabel: null, seat: null, status: "ACTIVE" })).toBe(false);
  });
  it("a seat holder is tougher than the same power in the open", () => {
    expect(seatHolderStats(90).hp).toBeGreaterThan(actorCombatStats(90).hp);
  });
  it("only the revolution's top two and the fleet admiral can open a war", () => {
    expect(seatWarKind("REV_LEADER")).toBe("REVOLUTION");
    expect(seatWarKind("REV_CHIEF")).toBe("REVOLUTION");
    expect(seatWarKind("REV_COMMANDER")).toBeNull();
    expect(seatWarKind("FLEET_ADMIRAL")).toBe("JUSTICE");
    expect(seatWarKind("ADMIRAL")).toBeNull();
    expect(seatWarKind(null)).toBeNull();
  });
  it("recognises a revolutionary base", () => {
    expect(isRevolutionBase("Ejército Revolucionario")).toBe(true);
    expect(isRevolutionBase("Marina")).toBe(false);
  });
  it("picks deterministically", () => {
    expect(pickBySeed([1, 2, 3], "x")).toBe(pickBySeed([1, 2, 3], "x"));
    expect(pickBySeed([], "x")).toBeNull();
  });
});

describe("wars from a seat", () => {
  const base = { hasOpenWar: false, lastWarEndedAt: null, now, cooldownMs: 3 * 24 * 3600_000 };
  it("lets the revolutionary leader declare war on the Government", () => {
    expect(seatWarBlockReason({ ...base, kind: "REVOLUTION", seat: "REV_LEADER" })).toBeNull();
    expect(seatWarBlockReason({ ...base, kind: "REVOLUTION", seat: "REV_COMMANDER" })).toContain("Líder");
  });
  it("lets the fleet admiral declare war only on a Yonko", () => {
    expect(seatWarBlockReason({ ...base, kind: "JUSTICE", seat: "FLEET_ADMIRAL", targetIsEmperor: true })).toBeNull();
    expect(seatWarBlockReason({ ...base, kind: "JUSTICE", seat: "FLEET_ADMIRAL", targetIsEmperor: false })).toContain("Yonko");
    expect(seatWarBlockReason({ ...base, kind: "JUSTICE", seat: "ADMIRAL", targetIsEmperor: true })).toContain("Almirante de Flota");
  });
  it("one war at a time, with a rest in between", () => {
    expect(seatWarBlockReason({ ...base, kind: "REVOLUTION", seat: "REV_CHIEF", hasOpenWar: true })).toContain("guerra abierta");
    expect(seatWarBlockReason({ ...base, kind: "REVOLUTION", seat: "REV_CHIEF", lastWarEndedAt: new Date(now.getTime() - 3600_000) })).toContain("recuperan");
  });
});
