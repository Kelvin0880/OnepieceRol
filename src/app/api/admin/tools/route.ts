import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUserId, UnauthorizedError, ForbiddenError } from "@/lib/require-user";
import { AdminToolError, adminCreateEvent, adminEventOp, dismissReport, getAdminOverview, proposeHappening, publishAnnouncement, startArcManual } from "@/lib/game/admin-tools";
import { logError } from "@/lib/log-error";

const island = z.string().max(80).optional().nullable();
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("dismiss_report"), id: z.string() }),
  z.object({ op: z.literal("announce"), headline: z.string().max(200), body: z.string().max(4000) }),
  z.object({ op: z.literal("propose_happening"), idea: z.string().max(800).optional().nullable(), island }),
  z.object({ op: z.literal("create_event"), idea: z.string().max(800).optional().nullable(), island, maxLevel: z.number().int().min(1).max(60).optional(), withFruit: z.boolean().optional().nullable() }),
  z.object({ op: z.literal("cancel_event"), eventId: z.string() }),
  z.object({ op: z.literal("force_event"), eventId: z.string() }),
  z.object({ op: z.literal("start_arc"), target: z.string().max(80), aggressor: z.string().max(80), kind: z.enum(["death", "capture", "reclaim"]) }),
]);

export async function GET() {
  try {
    await requireAdminUserId();
    return NextResponse.json(await getAdminOverview());
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
      case "start_arc":
        await startArcManual(b.target, b.aggressor, b.kind);
        return NextResponse.json({ ok: true });
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
