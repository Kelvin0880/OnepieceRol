import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { startRescueRaid, RescueRaidError } from "@/lib/game/rescue-raid";
import { logError } from "@/lib/log-error";

const schema = z.object({ actorId: z.string() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    return NextResponse.json(await startRescueRaid(id, userId, parsed.data.actorId));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof RescueRaidError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/rescue", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
