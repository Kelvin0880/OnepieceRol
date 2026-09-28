import { pingCorsOrigin } from "@/lib/cors";

export const dynamic = "force-dynamic";

/** Wakes the free Render instance for the landing page; touches nothing (no database, no session). */
export function GET(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin" };
  const origin = pingCorsOrigin(request.headers.get("origin"), process.env.NODE_ENV === "production");
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return Response.json({ ok: true }, { headers });
}
