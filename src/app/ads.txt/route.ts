export const dynamic = "force-static";

export function GET() {
  return new Response("google.com, pub-1952398982375580, DIRECT, f08c47fec0942fa0\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
