import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { deliverCaptive, releaseCaptive, CustodyError } from "@/lib/game/custody";
import { logError } from "@/lib/log-error";

const schema = z.object({ op: z.enum(["deliver", "release"]), captiveId: z.string() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const out = parsed.data.op === "deliver" ? await deliverCaptive(id, userId, parsed.data.captiveId) : await releaseCaptive(id, userId, parsed.data.captiveId);
    return NextResponse.json(out);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof CustodyError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/custody", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
