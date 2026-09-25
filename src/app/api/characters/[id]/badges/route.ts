import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getBadges } from "@/lib/game/badges";
import { logError } from "@/lib/log-error";

const num = (v: string | null) => (v && /^\d{1,15}$/.test(v) ? Number(v) : null);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const q = req.nextUrl.searchParams;
    return NextResponse.json(await getBadges(id, userId, { news: num(q.get("news")), denden: num(q.get("denden")), events: num(q.get("events")) }));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message === "Personaje no encontrado.") return NextResponse.json({ error: err.message }, { status: 404 });
    await logError("api/characters/[id]/badges", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
