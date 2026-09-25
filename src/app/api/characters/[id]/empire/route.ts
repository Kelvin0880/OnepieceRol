import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getEmpire, sendOnErrand, EmpireError } from "@/lib/game/empire";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/log-error";

const schema = z.object({ op: z.literal("errand"), companionId: z.string(), kind: z.enum(["patrol", "tribute", "scout"]), islandId: z.string().optional() });

async function owned(id: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id }, select: { userId: true } });
  return !!c && c.userId === userId;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    if (!(await owned(id, userId))) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
    return NextResponse.json(await getEmpire(id));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    await logError("api/characters/[id]/empire GET", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    return NextResponse.json(await sendOnErrand(id, userId, parsed.data.companionId, parsed.data.kind, parsed.data.islandId));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof EmpireError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/empire POST", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
