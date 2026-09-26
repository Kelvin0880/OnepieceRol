import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getPathState } from "@/lib/game/path-guide";
import { logError } from "@/lib/log-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getPathState(id, userId));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    await logError("api/characters/[id]/path GET", err);
    return NextResponse.json({ error: "No se pudo calcular tu camino." }, { status: 500 });
  }
}
