import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getVoyageOptions, getVoyageView, settleVoyage } from "@/lib/game/voyage";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/log-error";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const c = await prisma.character.findUnique({ where: { id }, select: { userId: true } });
    if (!c || c.userId !== userId) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
    await settleVoyage(id);
    return NextResponse.json({ voyage: await getVoyageView(id), ...(await getVoyageOptions(id)) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    await logError("api/characters/[id]/voyage GET", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
