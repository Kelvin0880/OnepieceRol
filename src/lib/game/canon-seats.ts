import type { PrismaClient } from "@prisma/client";
import { CANON_SEATS, SEATS, type SeatId } from "../engine/faction-seats";

const EXPECTED_ROLE: Record<SeatId, string[]> = {
  ADMIRAL: ["ADMIRAL"],
  FLEET_ADMIRAL: ["ADMIRAL"],
  REV_COMMANDER: ["REVOLUTIONARY_COMMANDER"],
  REV_CHIEF: ["REVOLUTIONARY_COMMANDER"],
  REV_LEADER: ["REVOLUTIONARY_COMMANDER"],
  GOROSEI: ["GOROSEI"],
};

/**
 * Gives the canon holders their seat the first time. Idempotent and safe on a running world: an actor who already
 * lost a seat (demoted role, "destituido" label) or a seat already full (a player took it) is never touched.
 */
export async function assignCanonSeats(db: PrismaClient): Promise<number> {
  let assigned = 0;
  for (const [name, seat] of Object.entries(CANON_SEATS) as [string, SeatId][]) {
    const actor = await db.worldActor.findUnique({ where: { name } });
    if (!actor || actor.seat || actor.status !== "ACTIVE") continue;
    if (!EXPECTED_ROLE[seat].includes(actor.role) || /destituid|derrotad|^ex/i.test(actor.rankLabel ?? "")) continue;
    const taken = (await db.worldActor.count({ where: { seat } })) + (await db.character.count({ where: { seat, status: { not: "DEAD" } } }));
    if (taken >= SEATS[seat].seats) continue;
    await db.worldActor.update({ where: { id: actor.id }, data: { seat } });
    assigned++;
  }
  return assigned;
}
