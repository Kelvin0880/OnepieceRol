import { describe, it, expect } from "vitest";
import {
  phaseEnemy,
  phaseRewards,
  joinBlockReason,
  raidCooldownLeftMs,
  standingAfterMission,
  standingAfterMercy,
  canPledge,
  allyStats,
  raidExpired,
  RAID_PHASES,
  MAX_RAID_PARTICIPANTS,
  MAX_ALLIES,
  PLEDGE_MIN_STANDING,
  RAID_COOLDOWN_MS,
  RAID_LOSS_COOLDOWN_MS,
  RAID_IDLE_EXPIRY_MS,
  MAX_STANDING,
} from "./raid";

describe("phases", () => {
  it("has four phases and the last one is the deadliest", () => {
    const all = Array.from({ length: RAID_PHASES }, (_, i) => phaseEnemy(i + 1));
    expect(all[3].hp).toBeGreaterThan(all[0].hp);
    expect(all[3].atk).toBeGreaterThan(all[0].atk);
    expect(all.map((p) => p.name)).toEqual(["La Guardia de Pangea", "Los Cinco Ancianos", "Los Almirantes de la Marina", "El Rey Sin Nombre"]);
  });
  it("clamps out-of-range phases and pays more later", () => {
    expect(phaseEnemy(0)).toEqual(phaseEnemy(1));
    expect(phaseEnemy(99)).toEqual(phaseEnemy(RAID_PHASES));
    expect(phaseRewards(4).xp).toBeGreaterThan(phaseRewards(1).xp);
  });
});

describe("joinBlockReason", () => {
  const ok = { knowsTruth: true, onIsland: true, alreadyMustered: false, musterSize: 3 };
  it("lets a qualified player on the island join", () => {
    expect(joinBlockReason(ok)).toBeNull();
  });
  it("blocks those who haven't seen Laugh Tale, aren't there, are already in, or when it is full", () => {
    expect(joinBlockReason({ ...ok, knowsTruth: false })).toMatch(/Laugh Tale/);
    expect(joinBlockReason({ ...ok, onIsland: false })).toMatch(/Mary Geoise/);
    expect(joinBlockReason({ ...ok, alreadyMustered: true })).toMatch(/Ya formas parte/);
    expect(joinBlockReason({ ...ok, musterSize: MAX_RAID_PARTICIPANTS })).toMatch(/completa/);
  });
});

describe("cooldown", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("a victory imposes a week, a defeat a day, a cancelled raid nothing", () => {
    expect(raidCooldownLeftMs(now, "WON", now)).toBe(RAID_COOLDOWN_MS);
    expect(raidCooldownLeftMs(now, "LOST", now)).toBe(RAID_LOSS_COOLDOWN_MS);
    expect(raidCooldownLeftMs(now, "CANCELLED", now)).toBe(0);
    expect(raidCooldownLeftMs(null, null, now)).toBe(0);
  });
  it("counts down and ends", () => {
    const later = new Date(now.getTime() + RAID_LOSS_COOLDOWN_MS + 1);
    expect(raidCooldownLeftMs(now, "LOST", later)).toBe(0);
  });
});

describe("standing and pledges", () => {
  it("missions and mercy raise standing, capped", () => {
    expect(standingAfterMission(0, 0)).toBeLessThan(standingAfterMission(0, 3));
    expect(standingAfterMission(95, 3)).toBe(MAX_STANDING);
    expect(standingAfterMercy(50)).toBe(60);
    expect(standingAfterMercy(99)).toBe(MAX_STANDING);
  });
  it("an actor can be pledged only with enough standing and while slots remain", () => {
    expect(canPledge(PLEDGE_MIN_STANDING - 1, 0).ok).toBe(false);
    expect(canPledge(PLEDGE_MIN_STANDING, 0).ok).toBe(true);
    expect(canPledge(100, MAX_ALLIES).ok).toBe(false);
  });
  it("allies are strong but weaker than the same actor as an enemy", () => {
    const a = allyStats(90);
    expect(a.atk).toBeGreaterThan(30);
    expect(a.hp).toBeLessThan(90 * 16);
  });
});

describe("expiry", () => {
  it("an idle raid lapses", () => {
    expect(raidExpired(0, RAID_IDLE_EXPIRY_MS)).toBe(false);
    expect(raidExpired(0, RAID_IDLE_EXPIRY_MS + 1)).toBe(true);
  });
});
