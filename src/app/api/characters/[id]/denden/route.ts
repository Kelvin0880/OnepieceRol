import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getDenDen, sendDenDen, DenDenError } from "@/lib/game/denden";
import { logError } from "@/lib/log-error";

const schema = z.object({ text: z.string().min(1).max(2000) });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getDenDen(id, userId));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof DenDenError) return NextResponse.json({ error: err.message }, { status: 404 });
    await logError("api/characters/[id]/denden GET", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    return NextResponse.json(await sendDenDen(id, userId, parsed.data.text));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof DenDenError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/denden POST", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
