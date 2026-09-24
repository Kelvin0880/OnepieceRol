import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getColiseumState, registerForTournament, withdrawFromTournament, submitStrategy, tickColiseum, ColiseumError } from "@/lib/game/coliseum";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("register") }),
  z.object({ op: z.literal("withdraw") }),
  z.object({ op: z.literal("strategy"), text: z.string().max(600) }),
]);

async function fail(err: unknown, ctx: string) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ColiseumError) return NextResponse.json({ error: err.message }, { status: 400 });
  await logError(ctx, err);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}

async function owned(id: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id }, select: { userId: true } });
  if (!c || c.userId !== userId) throw new ColiseumError("Personaje no encontrado.");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await owned(id, userId);
    void tickColiseum();
    return NextResponse.json(await getColiseumState(id));
  } catch (err) {
    return fail(err, "api/characters/[id]/coliseum GET");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const b = parsed.data;
    const out = b.op === "register" ? await registerForTournament(id, userId) : b.op === "withdraw" ? await withdrawFromTournament(id, userId) : await submitStrategy(id, userId, b.text);
    return NextResponse.json(out);
  } catch (err) {
    return fail(err, "api/characters/[id]/coliseum POST");
  }
}
