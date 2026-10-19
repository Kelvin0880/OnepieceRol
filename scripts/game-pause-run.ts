// Does the actual work of scripts/game-pause.mjs (status | on | off). Run through that wrapper, not directly.
import "dotenv/config";
import { pauseGame, resumeGame, getPausedAt, forgetPauseCache } from "../src/lib/game/pause";

async function main() {
  const action = process.argv[2];
  const prod = process.env.GAME_DB === "prod";
  const { prisma: devClient } = await import("../src/lib/db");
  // The production client is generated on the fly by the wrapper (the normal client speaks SQLite).
  const db = prod ? new (require("../.prod-client").PrismaClient)() : devClient;
  try {
    // Same idempotent statement the server runs on boot, so the script also works before the new version is deployed.
    if (prod) await db.$executeRawUnsafe('ALTER TABLE "WorldClock" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3)');
    if (action === "on") {
      const r = await pauseGame(db);
      console.log(r.already ? `Ya estaba en pausa desde ${r.since.toISOString()}.` : "Juego PAUSADO. Nadie puede jugar y no se gasta IA.");
    } else if (action === "off") {
      const r = await resumeGame(db);
      if (!r) console.log("El juego no estaba en pausa.");
      else {
        const minutes = Math.round(r.pausedMs / 60_000);
        console.log(`Juego REANUDADO tras ${minutes} min en pausa. Relojes movidos hacia adelante:`);
        for (const [model, n] of Object.entries(r.shifted)) console.log(`  ${model}: ${n}`);
      }
    } else if (action === "status") {
      forgetPauseCache();
      const since = await getPausedAt(db);
      console.log(since ? `PAUSADO desde ${since.toISOString()}` : "El juego está en marcha.");
    } else {
      throw new Error("Uso: node scripts/game-pause.mjs status|on|off [--dev]");
    }
  } finally {
    await db.$disconnect();
  }
}
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
