// Derives prisma/schema.production.prisma (postgresql datasource) from the
// committed prisma/schema.prisma (sqlite, used for local dev) so there is a
// single source of truth for models — only the datasource `provider` line
// differs between dev and production. Regenerated on every production build
// (see render.yaml); never hand-edit the output file.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "prisma/schema.prisma"), "utf8");

if (!source.includes('provider = "sqlite"')) {
  throw new Error('Expected prisma/schema.prisma to declare provider = "sqlite" — did the dev datasource change?');
}

const production = source.replace('provider = "sqlite"', 'provider = "postgresql"');
writeFileSync(join(root, "prisma/schema.production.prisma"), production);
console.log("Wrote prisma/schema.production.prisma (postgresql) from prisma/schema.prisma (sqlite).");
