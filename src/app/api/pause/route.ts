import { getPausedAt } from "@/lib/game/pause";

export const dynamic = "force-dynamic";

/** Public: tells the pages whether the game is paused (they show a banner). */
export async function GET() {
  const since = await getPausedAt();
  return Response.json({ paused: since !== null, since }, { headers: { "Cache-Control": "no-store" } });
}
