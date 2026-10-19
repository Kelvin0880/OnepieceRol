// Owner switch: node scripts/game-pause.mjs status|on|off [--dev]   (see PAUSA.md)
// Without --dev it talks to the production database: put the Neon connection string in GAME_DATABASE_URL or type it
// when asked (nothing is saved). It builds a throwaway Postgres client, does the job, and deletes the client.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [action, ...flags] = process.argv.slice(2);
if (!["status", "on", "off"].includes(action ?? "")) {
  console.error("Uso: node scripts/game-pause.mjs status|on|off [--dev]");
  process.exit(1);
}
const dev = flags.includes("--dev");

// Connection saved once in .env.pause (gitignored) so the switch runs with no questions.
if (!process.env.GAME_DATABASE_URL) {
  try {
    const line = readFileSync(join(root, ".env.pause"), "utf8").split(/\r?\n/).find((l) => l.startsWith("GAME_DATABASE_URL="));
    if (line) process.env.GAME_DATABASE_URL = line.slice("GAME_DATABASE_URL=".length).trim();
  } catch {}
}

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let text = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(text);
          return;
        }
        if (c === "\u0003") process.exit(1);
        if (c === "\u007f" || c === "\b") text = text.slice(0, -1);
        else text += c;
      }
    };
    stdin.on("data", onData);
  });
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`Falló: ${cmd} ${args.join(" ")}`);
}

const deploySchema = join(root, "prisma", "schema.deploy.prisma");
const prodClient = join(root, ".prod-client");

async function main() {
  if (dev) return run("npx", ["tsx", "scripts/game-pause-run.ts", action], {});
  const url = process.env.GAME_DATABASE_URL || (await askHidden("Conexión de la base de producción (Neon): "));
  if (!url.startsWith("postgres")) throw new Error("Eso no parece una conexión de Postgres.");
  try {
    run("node", ["scripts/gen-prod-schema.mjs"], {});
    const schema = readFileSync(join(root, "prisma", "schema.production.prisma"), "utf8");
    writeFileSync(deploySchema, schema.replace(/generator client \{/, 'generator client {\n  output = "../.prod-client"'));
    run("npx", ["prisma", "generate", "--schema=prisma/schema.deploy.prisma"], { DATABASE_URL: url });
    run("npx", ["tsx", "scripts/game-pause-run.ts", action], { DATABASE_URL: url, GAME_DB: "prod" });
  } finally {
    rmSync(deploySchema, { force: true });
    rmSync(prodClient, { recursive: true, force: true });
  }
}
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
