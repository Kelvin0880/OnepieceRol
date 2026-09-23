import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { WeaponGrade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { GameActionError } from "@/lib/game/perform-action";
import { COMMON_WEAPONS } from "@/lib/game/common-gear";
import { weaponPrice } from "@/lib/engine/economy";
import { logError } from "@/lib/log-error";

export async function GET() {
  const unclaimedLegendary = await prisma.weapon.findMany({ where: { ownerId: null } });
  return NextResponse.json({
    common: COMMON_WEAPONS.map((w) => ({ ...w, grade: WeaponGrade.NONE })),
    legendary: unclaimedLegendary.map((w) => ({ ...w, price: weaponPrice(w.basePrice, w.grade) })),
  });
}

const schema = z.union([
  z.object({ kind: z.literal("common"), name: z.string() }),
  z.object({ kind: z.literal("legendary"), weaponId: z.string() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Compra inválida." }, { status: 400 });

    const character = await prisma.character.findUnique({ where: { id } });
    if (!character || character.userId !== userId) throw new GameActionError("Personaje no encontrado.");

    const order = parsed.data;
    if (order.kind === "common") {
      const spec = COMMON_WEAPONS.find((w) => w.name === order.name);
      if (!spec) return NextResponse.json({ error: "Arma desconocida." }, { status: 404 });
      if (character.berries < spec.basePrice) throw new GameActionError("No tienes suficientes berries.");

      const weapon = await prisma.weapon.create({
        data: { name: spec.name, kind: spec.kind, grade: WeaponGrade.NONE, description: spec.description, atkBonus: spec.atkBonus, basePrice: spec.basePrice, ownerId: character.id },
      });
      await prisma.character.update({ where: { id: character.id }, data: { berries: character.berries - spec.basePrice } });
      return NextResponse.json({ weapon });
    }

    const weapon = await prisma.weapon.findUnique({ where: { id: order.weaponId } });
    if (!weapon || weapon.ownerId) throw new GameActionError("Esa arma ya no está disponible.");
    const price = weaponPrice(weapon.basePrice, weapon.grade);
    if (character.berries < price) throw new GameActionError("No tienes suficientes berries.");

    await prisma.weapon.update({ where: { id: weapon.id }, data: { ownerId: character.id } });
    await prisma.character.update({ where: { id: character.id }, data: { berries: character.berries - price } });
    return NextResponse.json({ weapon });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof GameActionError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/shop", err);
    return NextResponse.json({ error: "Error inesperado en la tienda." }, { status: 500 });
  }
}
