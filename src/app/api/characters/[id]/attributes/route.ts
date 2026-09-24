import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { spendAttributePoints, AttributeError } from "@/lib/game/attributes";
import { logError } from "@/lib/log-error";

const point = z.number().int().min(0).max(1000).optional();
const schema = z.object({ strength: point, agility: point, durability: point, willpower: point, intellect: point }).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Reparto inválido." }, { status: 400 });
    return NextResponse.json(await spendAttributePoints(id, userId, parsed.data));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof AttributeError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/attributes", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
