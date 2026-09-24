import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Public: a crew's flag is meant to be seen by everyone. Served with its stored, sniffed type and never as HTML. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const crew = await prisma.crew.findUnique({ where: { id }, select: { flagImage: true, flagImageType: true } });
  if (!crew?.flagImage || !crew.flagImageType) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(crew.flagImage), {
    headers: { "Content-Type": crew.flagImageType, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
