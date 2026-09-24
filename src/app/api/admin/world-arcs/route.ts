import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUserId, UnauthorizedError, ForbiddenError } from "@/lib/require-user";
import { decideArc, getArcsForAdmin, advanceArcNow, cancelArc, WorldArcError } from "@/lib/game/world-arcs";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("decide"), arcId: z.string(), approve: z.boolean() }),
  z.object({ op: z.literal("advance"), arcId: z.string() }),
  z.object({ op: z.literal("cancel"), arcId: z.string() }),
]);

export async function GET() {
  try {
    await requireAdminUserId();
    return NextResponse.json({ arcs: await getArcsForAdmin() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username } = await requireAdminUserId();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const body = parsed.data;
    switch (body.op) {
      case "decide":
        return NextResponse.json(await decideArc(body.arcId, body.approve, username));
      case "advance":
        await advanceArcNow(body.arcId);
        return NextResponse.json({ ok: true });
      case "cancel":
        await cancelArc(body.arcId);
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    return fail(err);
  }
}

async function fail(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
  if (err instanceof WorldArcError) return NextResponse.json({ error: err.message }, { status: 400 });
  await logError("api/admin/world-arcs", err);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}
