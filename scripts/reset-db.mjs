// Cross-platform dev DB reset: delete the SQLite file, re-push the schema, re-seed.
import { existsSync, unlinkSync } from "fs";
import { execSync } from "child_process";

for (const f of ["prisma/dev.db", "prisma/dev.db-journal"]) {
  if (existsSync(f)) unlinkSync(f);
}
execSync("npx prisma db push", { stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
