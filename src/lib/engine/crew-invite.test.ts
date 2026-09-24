import { describe, it, expect } from "vitest";
import { inviteBlockReason, inviteExpired, InviteCheck, INVITE_TTL_MS, MAX_CREW_MEMBERS, MAX_PENDING_INVITES_PER_CREW } from "./crew-invite";

const ok: InviteCheck = { inviterHasCrew: true, targetAlive: true, targetHasCrew: false, sameFaction: true, isSelf: false, alreadyPending: false, pendingInCrew: 0, crewSize: 2 };

describe("inviteBlockReason", () => {
  it("allows a valid invitation", () => expect(inviteBlockReason(ok)).toBeNull());
  it.each([
    [{ inviterHasCrew: false }, "tripulación"],
    [{ isSelf: true }, "ti mismo"],
    [{ targetAlive: false }, "ya no puede"],
    [{ targetHasCrew: true }, "otra tripulación"],
    [{ sameFaction: false }, "misma facción"],
    [{ alreadyPending: true }, "pendiente"],
    [{ crewSize: MAX_CREW_MEMBERS }, "completa"],
    [{ pendingInCrew: MAX_PENDING_INVITES_PER_CREW }, "demasiadas"],
  ] as [Partial<InviteCheck>, string][])("refuses %j", (patch, word) => {
    expect(inviteBlockReason({ ...ok, ...patch })).toContain(word);
  });
});

describe("inviteExpired", () => {
  it("expires after the TTL only", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(inviteExpired(new Date(now.getTime() - INVITE_TTL_MS + 1000), now)).toBe(false);
    expect(inviteExpired(new Date(now.getTime() - INVITE_TTL_MS - 1000), now)).toBe(true);
  });
});
