import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { challengeSeat, claimVacantSeat, getSeatState, resignSeat, respondSeatChallenge, SeatError, withdrawSeatChallenge } from "@/lib/game/faction-seats";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("challenge"), seat: z.string().min(1), targetKind: z.enum(["canon", "player"]), targetId: z.string().min(1) }),
  z.object({ op: z.literal("respond"), challengeId: z.string().min(1), accept: z.boolean() }),
  z.object({ op: z.literal("withdraw"), challengeId: z.string().min(1) }),
  z.object({ op: z.literal("claim"), seat: z.string().min(1) }),
  z.object({ op: z.literal("resign") }),
]);

function fail(err: unknown, where: string) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof SeatError) return NextResponse.json({ error: err.message }, { status: 400 });
  return logError(where, err).then(() => NextResponse.json({ error: "Error inesperado." }, { status: 500 }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getSeatState(id, userId));
  } catch (err) {
    return fail(err, "api/characters/[id]/seats GET");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const d = parsed.data;
    switch (d.op) {
      case "challenge":
        return NextResponse.json(await challengeSeat(id, userId, d.seat, d.targetKind, d.targetId));
      case "respond":
        return NextResponse.json(await respondSeatChallenge(id, userId, d.challengeId, d.accept));
      case "withdraw":
        return NextResponse.json(await withdrawSeatChallenge(id, userId, d.challengeId));
      case "claim":
        return NextResponse.json(await claimVacantSeat(id, userId, d.seat));
      case "resign":
        return NextResponse.json(await resignSeat(id, userId));
    }
  } catch (err) {
    return fail(err, "api/characters/[id]/seats POST");
  }
}
