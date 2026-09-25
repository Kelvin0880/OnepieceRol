import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { setCharacterPortrait, PortraitError } from "@/lib/game/portrait";
import { logError } from "@/lib/log-error";

const schema = z.object({ dataUrl: z.string().max(400_000).nullable() });

/** Public on purpose: a wanted poster is meant to be seen by everyone. Served with its sniffed type and never as HTML. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.characterPortrait.findUnique({ where: { characterId: id } });
  if (!row) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(row.image), {
    headers: { "Content-Type": row.mimeType, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    return NextResponse.json(await setCharacterPortrait(id, userId, parsed.data.dataUrl));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof PortraitError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/portrait", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
