import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { createCrew, joinCrew, leaveCrew, inviteToCrew, respondToCrewInvite, cancelCrewInvite, kickCrewMember, findCrewCandidates, listCrewInvites, CrewError } from "@/lib/game/crew";
import { dismissCompanion, CompanionError } from "@/lib/game/companions";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), name: z.string(), flagDesc: z.string(), shipName: z.string().optional() }),
  z.object({ op: z.literal("join"), inviteCode: z.string() }),
  z.object({ op: z.literal("leave") }),
  z.object({ op: z.literal("invite"), targetCharacterId: z.string().optional(), targetName: z.string().max(60).optional() }),
  z.object({ op: z.literal("respond"), inviteId: z.string(), accept: z.boolean() }),
  z.object({ op: z.literal("cancel_invite"), inviteId: z.string() }),
  z.object({ op: z.literal("kick"), targetId: z.string() }),
  z.object({ op: z.literal("dismiss_companion"), companionId: z.string() }),
]);

/** The panel's data: pending invitations and, on demand, who can be invited (same island by default, or by name). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const name = req.nextUrl.searchParams.get("name") ?? undefined;
    const [invites, candidates] = await Promise.all([listCrewInvites(id, userId), findCrewCandidates(id, userId, name)]);
    return NextResponse.json({ ...invites, candidates });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    switch (parsed.data.op) {
      case "create":
        return NextResponse.json(await createCrew(id, userId, parsed.data.name, parsed.data.flagDesc, parsed.data.shipName));
      case "join":
        return NextResponse.json(await joinCrew(id, userId, parsed.data.inviteCode));
      case "leave":
        await leaveCrew(id, userId);
        return NextResponse.json({ ok: true });
      case "invite":
        return NextResponse.json(await inviteToCrew(id, userId, { characterId: parsed.data.targetCharacterId, name: parsed.data.targetName }));
      case "respond":
        return NextResponse.json(await respondToCrewInvite(id, userId, parsed.data.inviteId, parsed.data.accept));
      case "cancel_invite":
        return NextResponse.json(await cancelCrewInvite(id, userId, parsed.data.inviteId));
      case "kick":
        return NextResponse.json(await kickCrewMember(id, userId, parsed.data.targetId));
      case "dismiss_companion":
        return NextResponse.json({ message: await dismissCompanion(id, userId, parsed.data.companionId) });
    }
  } catch (err) {
    return fail(err);
  }
}

async function fail(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof CrewError || err instanceof CompanionError) return NextResponse.json({ error: err.message }, { status: 400 });
  await logError("api/characters/[id]/crew", err);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}
