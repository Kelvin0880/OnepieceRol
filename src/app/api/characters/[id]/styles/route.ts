import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getStylesView, learnStyle, trainStyle, setStyleFocus, setWielded, StyleError } from "@/lib/game/styles";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("learn"), styleId: z.string().max(40) }),
  z.object({ op: z.literal("train"), styleId: z.string().max(40) }),
  z.object({ op: z.literal("focus"), styleId: z.string().max(40).nullable() }),
  z.object({ op: z.literal("wield"), weaponId: z.string().max(60), wield: z.boolean() }),
]);

async function fail(err: unknown, ctx: string) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof StyleError) return NextResponse.json({ error: err.message }, { status: 400 });
  await logError(ctx, err);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getStylesView(id, userId));
  } catch (err) {
    return fail(err, "api/characters/[id]/styles GET");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const b = parsed.data;
    const out = b.op === "learn" ? await learnStyle(id, userId, b.styleId) : b.op === "train" ? await trainStyle(id, userId, b.styleId) : b.op === "focus" ? await setStyleFocus(id, userId, b.styleId) : await setWielded(id, userId, b.weaponId, b.wield);
    return NextResponse.json(out);
  } catch (err) {
    return fail(err, "api/characters/[id]/styles POST");
  }
}
