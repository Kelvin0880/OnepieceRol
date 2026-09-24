import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getInventoryView, useInventoryItem, sellInventoryItem, buyInventoryItem, eatFruit, sellFruit, InventoryError } from "@/lib/game/inventory";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("use"), itemId: z.string().max(40) }),
  z.object({ op: z.literal("sell"), itemId: z.string().max(40), quantity: z.number().int().min(1).max(99).optional() }),
  z.object({ op: z.literal("buy"), itemId: z.string().max(40) }),
  z.object({ op: z.literal("eat"), inventoryItemId: z.string().max(60) }),
  z.object({ op: z.literal("sellFruit"), inventoryItemId: z.string().max(60) }),
]);

function fail(err: unknown, ctx: string) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof InventoryError) return NextResponse.json({ error: err.message }, { status: 400 });
  return logError(ctx, err).then(() => NextResponse.json({ error: "Error inesperado." }, { status: 500 }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getInventoryView(id, userId));
  } catch (err) {
    return fail(err, "api/characters/[id]/inventory GET");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const b = parsed.data;
    const out =
      b.op === "use" ? await useInventoryItem(id, userId, b.itemId)
      : b.op === "sell" ? await sellInventoryItem(id, userId, b.itemId, b.quantity ?? 1)
      : b.op === "eat" ? await eatFruit(id, userId, b.inventoryItemId)
      : b.op === "sellFruit" ? await sellFruit(id, userId, b.inventoryItemId)
      : await buyInventoryItem(id, userId, b.itemId);
    return NextResponse.json(out);
  } catch (err) {
    return fail(err, "api/characters/[id]/inventory POST");
  }
}
