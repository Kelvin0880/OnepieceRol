import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getFruitRemovalOffer, removeDevilFruit, FruitRemovalError } from "@/lib/game/fruit-removal";
import { logError } from "@/lib/log-error";

const schema = z.object({ fruitName: z.string().min(1).max(120) });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getFruitRemovalOffer(id, userId));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof FruitRemovalError) return NextResponse.json({ error: err.message }, { status: 404 });
    await logError("api/characters/[id]/fruit-removal GET", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    return NextResponse.json(await removeDevilFruit(id, userId, parsed.data.fruitName));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof FruitRemovalError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/fruit-removal POST", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
