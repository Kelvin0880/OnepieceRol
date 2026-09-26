import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUserId, UnauthorizedError, ForbiddenError } from "@/lib/require-user";
import {
  AdminToolError, adminStartDispatch, adminCreateEvent, adminEventOp, dismissReport, getAdminOverview, proposeHappening, publishAnnouncement, startArcManual,
  adminListWars, adminStartCanonWar, adminRunWarFront, adminEndWar,
  adminListSeatChallenges, adminStartSeatEvent, adminResolveSeatDuel,
  adminAdjustCharacter, adminTeleport, adminHeal, adminReleasePrisoner, adminSetIslandControl, adminGiveItem, adminGiveFruit,
  ADJUSTABLE_FIELDS,
} from "@/lib/game/admin-tools";
import { logError } from "@/lib/log-error";

const island = z.string().max(80).optional().nullable();
const name = z.string().min(1).max(80);
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("dismiss_report"), id: z.string() }),
  z.object({ op: z.literal("announce"), headline: z.string().max(200), body: z.string().max(4000) }),
  z.object({ op: z.literal("propose_happening"), idea: z.string().max(800).optional().nullable(), island }),
  z.object({ op: z.literal("create_event"), idea: z.string().max(800).optional().nullable(), island, maxLevel: z.number().int().min(1).max(60).optional(), withFruit: z.boolean().optional().nullable() }),
  z.object({ op: z.literal("cancel_event"), eventId: z.string() }),
  z.object({ op: z.literal("force_event"), eventId: z.string() }),
  z.object({ op: z.literal("start_dispatch"), admiral: z.string().max(80).optional().nullable(), island, minutes: z.number().min(1).max(240).optional().nullable() }),
  z.object({ op: z.literal("start_arc"), target: z.string().max(80), aggressor: z.string().max(80), kind: z.enum(["death", "capture", "reclaim"]) }),
  z.object({ op: z.literal("start_canon_war") }),
  z.object({ op: z.literal("run_war_front"), warId: z.string() }),
  z.object({ op: z.literal("end_war"), warId: z.string() }),
  z.object({ op: z.literal("start_seat_event") }),
  z.object({ op: z.literal("resolve_seat_duel"), challengeId: z.string() }),
  z.object({ op: z.literal("adjust_character"), name, field: z.enum(ADJUSTABLE_FIELDS), value: z.number() }),
  z.object({ op: z.literal("teleport"), name, island: z.string().min(1).max(80) }),
  z.object({ op: z.literal("heal"), name }),
  z.object({ op: z.literal("release_prisoner"), name }),
  z.object({ op: z.literal("set_island_control"), island: z.string().min(1).max(80), control: z.string().max(80).optional().nullable() }),
  z.object({ op: z.literal("give_item"), name, itemId: z.string().max(60) }),
  z.object({ op: z.literal("give_fruit"), name, fruitName: z.string().max(80) }),
]);

export async function GET() {
  try {
    await requireAdminUserId();
    const [overview, wars, seatChallenges] = await Promise.all([getAdminOverview(), adminListWars(), adminListSeatChallenges()]);
    return NextResponse.json({ ...overview, wars, seatChallenges });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const b = parsed.data;
    switch (b.op) {
      case "dismiss_report":
        await dismissReport(b.id);
        return NextResponse.json({ ok: true });
      case "announce":
        await publishAnnouncement(b.headline, b.body);
        return NextResponse.json({ ok: true });
      case "propose_happening":
        await proposeHappening(b.idea ?? null, b.island || null);
        return NextResponse.json({ ok: true });
      case "create_event": {
        const ev = await adminCreateEvent({ idea: b.idea ?? null, islandName: b.island || null, maxLevel: b.maxLevel, withFruit: b.withFruit ?? null });
        return NextResponse.json({ ok: true, title: ev.title });
      }
      case "cancel_event":
        await adminEventOp("cancel", b.eventId);
        return NextResponse.json({ ok: true });
      case "force_event":
        await adminEventOp("force", b.eventId);
        return NextResponse.json({ ok: true });
      case "start_dispatch": {
        const d = await adminStartDispatch(b.admiral ?? null, b.island || null, b.minutes ?? null);
        return NextResponse.json({ ok: true, title: `${d.admiralName} → ${d.targetIslandName}` });
      }
      case "start_arc":
        await startArcManual(b.target, b.aggressor, b.kind);
        return NextResponse.json({ ok: true });
      case "start_canon_war": {
        const w = await adminStartCanonWar();
        return NextResponse.json({ ok: true, title: `${w.attackerName} vs ${w.defenderName}` });
      }
      case "run_war_front": {
        const line = await adminRunWarFront(b.warId);
        return NextResponse.json({ ok: true, title: line });
      }
      case "end_war":
        await adminEndWar(b.warId);
        return NextResponse.json({ ok: true });
      case "start_seat_event":
        await adminStartSeatEvent();
        return NextResponse.json({ ok: true });
      case "resolve_seat_duel":
        await adminResolveSeatDuel(b.challengeId);
        return NextResponse.json({ ok: true });
      case "adjust_character": {
        const line = await adminAdjustCharacter(b.name, b.field, b.value);
        return NextResponse.json({ ok: true, title: line });
      }
      case "teleport": {
        const line = await adminTeleport(b.name, b.island);
        return NextResponse.json({ ok: true, title: line });
      }
      case "heal": {
        const line = await adminHeal(b.name);
        return NextResponse.json({ ok: true, title: line });
      }
      case "release_prisoner": {
        const line = await adminReleasePrisoner(b.name);
        return NextResponse.json({ ok: true, title: line });
      }
      case "set_island_control": {
        const line = await adminSetIslandControl(b.island, b.control ?? null);
        return NextResponse.json({ ok: true, title: line });
      }
      case "give_item": {
        const line = await adminGiveItem(b.name, b.itemId);
        return NextResponse.json({ ok: true, title: line });
      }
      case "give_fruit": {
        const line = await adminGiveFruit(b.name, b.fruitName);
        return NextResponse.json({ ok: true, title: line });
      }
    }
  } catch (err) {
    return fail(err);
  }
}

async function fail(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
  if (err instanceof AdminToolError) return NextResponse.json({ error: err.message }, { status: 400 });
  await logError("api/admin/tools", err);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}
