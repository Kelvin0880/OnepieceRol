import { NextResponse, type NextRequest } from "next/server";
import { blockedWhilePaused, PAUSED_MESSAGE } from "@/lib/engine/pause";
import { isPaused } from "@/lib/game/pause";

// Owner pause (PAUSA.md): while paused, every write and every character read is refused with a 503.
export async function proxy(request: NextRequest) {
  if (blockedWhilePaused(request.method, request.nextUrl.pathname) && (await isPaused())) {
    return NextResponse.json({ error: PAUSED_MESSAGE, paused: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
