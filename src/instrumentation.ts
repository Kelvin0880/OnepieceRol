// Runs once when the server boots. Production (Postgres) gets the pause column here so a deploy never has to wait
// for a manual `prisma db push`; local SQLite gets it from the normal db push.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL?.startsWith("postgres")) return;
  const { prisma } = await import("@/lib/db");
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "WorldClock" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3)');
  } catch (err) {
    console.error("pause column check failed", err);
  }
}
