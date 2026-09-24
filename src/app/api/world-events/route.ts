import { NextResponse } from "next/server";
import { getWorldEvents } from "@/lib/game/world-arcs";
import { tickWorldIfDue } from "@/lib/game/world-tick";
import { sessionIsAdmin } from "@/lib/require-user";
import { logError } from "@/lib/log-error";

export async function GET() {
  void tickWorldIfDue().catch((e) => logError("world-events/tick", e));
  return NextResponse.json({ events: await getWorldEvents(6), isAdmin: await sessionIsAdmin() });
}
