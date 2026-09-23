import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { GameActionError } from "@/lib/game/perform-action";
import { logError } from "@/lib/log-error";

const schema = z.object({ weaponId: z.string() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    const character = await prisma.character.findUnique({ where: { id } });
    if (!character || character.userId !== userId) throw new GameActionError("Personaje no encontrado.");

    const weapon = await prisma.weapon.findUnique({ where: { id: parsed.data.weaponId } });
    if (!weapon || weapon.ownerId !== character.id) throw new GameActionError("No posees esa arma.");

    await prisma.character.update({ where: { id: character.id }, data: { equippedWeaponId: weapon.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof GameActionError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/equip", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
