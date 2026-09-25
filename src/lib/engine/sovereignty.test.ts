import { describe, expect, it } from "vitest";
import {
  baseGarrisonStats,
  canBeProclaimed,
  challengeBlockReason,
  declareWarBlockReason,
  emperorEnemyStats,
  emperorRequirements,
  figureNewsDue,
  FIGURE_NEWS_GAP_MS,
  governmentSparesWarlord,
  isMarineBase,
  isWorldFigure,
  parseFallenFate,
  revokedBounty,
  rivalGarrisonStats,
  tributeState,
  warlordRequirements,
  warlordTribute,
  warOutcome,
  WAR_DURATION_MS,
  WARLORD_REAPPLY_COOLDOWN_MS,
  WARLORD_SEATS,
  YONKO_CHALLENGE_COOLDOWN_MS,
  YONKO_SEATS,
  type EmperorInput,
  type WarlordInput,
} from "./sovereignty";
import { actorCombatStats } from "./guardian";

const now = new Date("2026-09-25T12:00:00Z");
const emperor: EmperorInput = { faction: "PIRATE", alive: true, level: 40, bounty: 1_500_000_000, territories: 1, forces: 3, isEmperor: false, isWarlord: false };

describe("emperor requirements", () => {
  it("accepts a pirate who has everything", () => {
    expect(emperorRequirements(emperor).ok).toBe(true);
  });
  it("lists exactly what is missing", () => {
    const r = emperorRequirements({ ...emperor, level: 20, bounty: 10, territories: 0 });
    expect(r.ok).toBe(false);
    expect(r.checks.filter((c) => !c.met).map((c) => c.id)).toEqual(["level", "bounty", "territory"]);
  });
  it("never lets a non-pirate, a warlord, the dead or an existing emperor through", () => {
    expect(emperorRequirements({ ...emperor, faction: "MARINE" }).ok).toBe(false);
    expect(emperorRequirements({ ...emperor, isWarlord: true }).ok).toBe(false);
    expect(emperorRequirements({ ...emperor, alive: false }).ok).toBe(false);
    expect(emperorRequirements({ ...emperor, isEmperor: true }).ok).toBe(false);
  });
  it("only proclaims into an empty throne", () => {
    expect(canBeProclaimed(true, YONKO_SEATS - 1)).toBe(true);
    expect(canBeProclaimed(true, YONKO_SEATS)).toBe(false);
    expect(canBeProclaimed(false, 0)).toBe(false);
  });
});

describe("challenging an emperor", () => {
  const ok = { eligible: true, sameIsland: true, targetActive: true, targetIsEmperor: true, lastChallengeAt: null, now };
  it("is allowed face to face", () => {
    expect(challengeBlockReason(ok)).toBeNull();
  });
  it("requires being on the same island, a live emperor and the requirements", () => {
    expect(challengeBlockReason({ ...ok, sameIsland: false })).toContain("misma isla");
    expect(challengeBlockReason({ ...ok, targetIsEmperor: false })).toContain("trono");
    expect(challengeBlockReason({ ...ok, eligible: false })).toContain("requisitos");
  });
  it("enforces the cooldown after a failed challenge", () => {
    expect(challengeBlockReason({ ...ok, lastChallengeAt: new Date(now.getTime() - 3600_000) })).toContain("espera 23 h");
    expect(challengeBlockReason({ ...ok, lastChallengeAt: new Date(now.getTime() - YONKO_CHALLENGE_COOLDOWN_MS) })).toBeNull();
  });
  it("makes an emperor tougher than the same power holding a territory", () => {
    const e = emperorEnemyStats(95);
    const h = actorCombatStats(95);
    expect(e.hp).toBeGreaterThan(h.hp);
    expect(e.atk).toBeGreaterThan(h.atk);
  });
  it("parses the fate the winner chooses", () => {
    expect(parseFallenFate("kill")).toBe("kill");
    expect(parseFallenFate("capture")).toBe("capture");
    expect(parseFallenFate("spare")).toBe("spare");
    expect(parseFallenFate("eat")).toBeNull();
  });
});

describe("warlords", () => {
  const w: WarlordInput = { faction: "PIRATE", alive: true, imprisoned: false, level: 25, bounty: 150_000_000, isEmperor: false, isWarlord: false, seatsTaken: 3, revokedAt: null, now };
  it("accepts a known pirate when a seat is free", () => {
    expect(warlordRequirements(w).ok).toBe(true);
  });
  it("refuses non-pirates, full councils, emperors and prisoners", () => {
    expect(warlordRequirements({ ...w, faction: "REVOLUTIONARY" }).ok).toBe(false);
    expect(warlordRequirements({ ...w, seatsTaken: WARLORD_SEATS }).ok).toBe(false);
    expect(warlordRequirements({ ...w, isEmperor: true }).ok).toBe(false);
    expect(warlordRequirements({ ...w, imprisoned: true }).ok).toBe(false);
  });
  it("remembers a betrayal for a week", () => {
    expect(warlordRequirements({ ...w, revokedAt: new Date(now.getTime() - 3600_000) }).checks.find((c) => c.id === "trust")!.met).toBe(false);
    expect(warlordRequirements({ ...w, revokedAt: new Date(now.getTime() - WARLORD_REAPPLY_COOLDOWN_MS) }).ok).toBe(true);
  });
  it("charges 1% of the bounty, never less than a million", () => {
    expect(warlordTribute(50_000_000)).toBe(1_000_000);
    expect(warlordTribute(300_000_000)).toBe(3_000_000);
  });
  it("tracks the tribute deadline with a day of grace", () => {
    expect(tributeState(null, now)).toBe("ok");
    expect(tributeState(new Date(now.getTime() + 1000), now)).toBe("ok");
    expect(tributeState(new Date(now.getTime() - 3600_000), now)).toBe("due");
    expect(tributeState(new Date(now.getTime() - 25 * 3600_000), now)).toBe("overdue");
  });
  it("raises the bounty of a betrayer", () => {
    expect(revokedBounty(100_000_000)).toBe(120_000_000);
  });
  it("is spared by Marines and CP-0, not by bounty hunters", () => {
    expect(governmentSparesWarlord("MARINE", true)).toBe(true);
    expect(governmentSparesWarlord("CP0", true)).toBe(true);
    expect(governmentSparesWarlord("BOUNTY_HUNTER", true)).toBe(false);
    expect(governmentSparesWarlord("MARINE", false)).toBe(false);
  });
});

describe("wars", () => {
  it("ends as soon as one side reaches three", () => {
    expect(warOutcome({ attacker: 3, defender: 1 }, now, now)).toBe("attacker");
    expect(warOutcome({ attacker: 0, defender: 3 }, now, now)).toBe("defender");
    expect(warOutcome({ attacker: 2, defender: 1 }, now, now)).toBeNull();
  });
  it("is decided by score (or a stalemate) when time runs out", () => {
    const later = new Date(now.getTime() + WAR_DURATION_MS);
    expect(warOutcome({ attacker: 2, defender: 1 }, now, later)).toBe("attacker");
    expect(warOutcome({ attacker: 1, defender: 1 }, now, later)).toBe("stalemate");
  });
  it("recognises Marine and Government strongholds", () => {
    expect(isMarineBase("Marina")).toBe(true);
    expect(isMarineBase("Gobierno Mundial (CP-0)")).toBe(true);
    expect(isMarineBase("Piratas de Barbanegra")).toBe(false);
    expect(isMarineBase(null)).toBe(false);
  });
  it("scales garrisons and caps power at 100", () => {
    expect(baseGarrisonStats(10, 200).hp).toBe(actorCombatStats(100).hp);
    expect(rivalGarrisonStats(100, 45).atk).toBeGreaterThan(rivalGarrisonStats(10, 45).atk);
  });
  it("only lets an emperor declare, one war at a time, never against themselves", () => {
    const base = { isEmperor: true, hasOpenWar: false, lastWarEndedAt: null, now };
    expect(declareWarBlockReason(base)).toBeNull();
    expect(declareWarBlockReason({ ...base, isEmperor: false })).toContain("Yonko");
    expect(declareWarBlockReason({ ...base, hasOpenWar: true })).toContain("Ya estás en guerra");
    expect(declareWarBlockReason({ ...base, targetIsSelf: true })).toContain("ti mismo");
    expect(declareWarBlockReason({ ...base, targetIsEmperor: false })).toContain("otro Yonko");
    expect(declareWarBlockReason({ ...base, lastWarEndedAt: new Date(now.getTime() - 3600_000) })).toContain("recupera");
  });
});

describe("world figures", () => {
  const base = { bounty: 0, notoriety: 0, isEmperor: false, isWarlord: false };
  it("follows emperors and warlords whatever their numbers", () => {
    expect(isWorldFigure({ ...base, faction: "PIRATE", isEmperor: true })).toBe(true);
    expect(isWorldFigure({ ...base, faction: "PIRATE", isWarlord: true })).toBe(true);
  });
  it("follows the top of every ladder", () => {
    expect(isWorldFigure({ ...base, faction: "PIRATE", bounty: 500_000_000 })).toBe(true);
    expect(isWorldFigure({ ...base, faction: "PIRATE", bounty: 499_999_999 })).toBe(false);
    expect(isWorldFigure({ ...base, faction: "MARINE", notoriety: 7_000 })).toBe(true);
    expect(isWorldFigure({ ...base, faction: "REVOLUTIONARY", notoriety: 2_400 })).toBe(true);
    expect(isWorldFigure({ ...base, faction: "BOUNTY_HUNTER", notoriety: 1_300 })).toBe(true);
  });
  it("keeps Cipher Pol agents in the shadows until the very top", () => {
    expect(isWorldFigure({ ...base, faction: "CP0", notoriety: 3_500 })).toBe(false);
    expect(isWorldFigure({ ...base, faction: "CP0", notoriety: 6_000 })).toBe(true);
  });
  it("throttles how often the papers follow one person", () => {
    expect(figureNewsDue(null, now)).toBe(true);
    expect(figureNewsDue(new Date(now.getTime() - 60_000), now)).toBe(false);
    expect(figureNewsDue(new Date(now.getTime() - FIGURE_NEWS_GAP_MS), now)).toBe(true);
  });
});
