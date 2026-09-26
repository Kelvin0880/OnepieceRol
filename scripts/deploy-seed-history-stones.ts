// One-off deploy helper: places the 6 Historia Poneglyphs on production. Idempotent (safe to re-run, e.g. after
// adding a new chapter to HISTORY_CHAPTERS). Uses an isolated Prisma client at .prod-client instead of the normal
// @prisma/client, so it never fights the local dev server for the query-engine DLL lock, and is loaded via a
// runtime require (not a static import) so tsc never tries to typecheck a gitignored, ephemeral directory that
// usually doesn't exist. Before running:
//   node scripts/gen-prod-schema.mjs
//   sed 's#provider = "prisma-client-js"#&\n  output = "<absolute path to repo>/.prod-client"#' prisma/schema.production.prisma > prisma/schema.deploy.prisma
//   DATABASE_URL="<neon>" npx prisma generate --schema=prisma/schema.deploy.prisma
// Usage: DATABASE_URL="<neon>" npx tsx scripts/deploy-seed-history-stones.ts
// Afterward: rm prisma/schema.deploy.prisma (gitignored, throwaway) and .prod-client/ (gitignored too).
import "dotenv/config";
import { createRequire } from "module";
import { seedHistoryStones } from "../src/lib/game/history-stones";

async function main() {
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require("../.prod-client/index.js");
  const db = new PrismaClient();
  const n = await seedHistoryStones(db);
  console.log(`placed/updated ${n} Historia Poneglyphs`);
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
