// Local pause panel (see PAUSA.md): node scripts/pause-panel.mjs  (or double-click panel-pausa.cmd).
// A tiny web page on http://127.0.0.1:4747 with Pause / Resume buttons. Reads the connection from .env.pause.
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4747;
const deploySchema = join(root, "prisma", "schema.deploy.prisma");
const prodClient = join(root, ".prod-client");

function readUrl() {
  if (process.env.GAME_DATABASE_URL) return process.env.GAME_DATABASE_URL;
  try {
    const line = readFileSync(join(root, ".env.pause"), "utf8").split(/\r?\n/).find((l) => l.startsWith("GAME_DATABASE_URL="));
    if (line) return line.slice("GAME_DATABASE_URL=".length).trim();
  } catch {}
  return "";
}
const url = readUrl();
if (!url.startsWith("postgres")) {
  console.error("Falta la conexión de Neon: pon GAME_DATABASE_URL=... en el archivo .env.pause");
  process.exit(1);
}

function cleanup() {
  rmSync(deploySchema, { force: true });
  rmSync(prodClient, { recursive: true, force: true });
}
cleanup();
console.log("Preparando la conexión (una sola vez, unos segundos)...");
const gen = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, shell: true, stdio: "ignore", env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`Falló: ${cmd} ${args.join(" ")}`);
};
gen("node", ["scripts/gen-prod-schema.mjs"]);
writeFileSync(deploySchema, readFileSync(join(root, "prisma", "schema.production.prisma"), "utf8").replace(/generator client \{/, 'generator client {\n  output = "../.prod-client"'));
gen("npx", ["prisma", "generate", "--schema=prisma/schema.deploy.prisma"], { DATABASE_URL: url });
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(0));

// One database job at a time.
let queue = Promise.resolve();
function runAction(action) {
  const job = queue.then(
    () =>
      new Promise((resolve) => {
        const child = spawn("npx", ["tsx", "scripts/game-pause-run.ts", action], { cwd: root, shell: true, env: { ...process.env, DATABASE_URL: url, GAME_DB: "prod" } });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (out += d));
        child.on("close", (code) => resolve({ code, out: out.split(/\r?\n/).filter((l) => l.trim() && !/injected env|DeprecationWarning|trace-deprecation/i.test(l)).join("\n") }));
      })
  );
  queue = job.catch(() => undefined);
  return job;
}

async function state(prefixLog = "") {
  const r = await runAction("status");
  const m = r.out.match(/PAUSADO desde (\S+)/);
  if (r.code !== 0 || (!m && !/en marcha/.test(r.out))) return { error: r.out.split("\n").pop() || "Error desconocido", log: prefixLog + r.out };
  return { paused: !!m, since: m ? m[1] : null, log: prefixLog + r.out };
}

const page = readFileSync(join(root, "scripts", "pause-panel.html"), "utf8");
const server = http.createServer(async (req, res) => {
  const send = (code, type, body) => {
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  };
  const json = (obj) => send(200, "application/json; charset=utf-8", JSON.stringify(obj));
  try {
    if (req.url === "/" && req.method === "GET") return send(200, "text/html; charset=utf-8", page);
    // The custom header cannot be sent by another website without a CORS preflight, so no outside page can press the buttons.
    if (req.headers["x-panel"] !== "1") return send(403, "text/plain", "No");
    if (req.url === "/api/state" && req.method === "GET") return json(await state());
    if (req.url === "/api/pause" && req.method === "POST") {
      const r = await runAction("on");
      return json(r.code === 0 ? await state(r.out + "\n") : { error: r.out.split("\n").pop(), log: r.out });
    }
    if (req.url === "/api/resume" && req.method === "POST") {
      const r = await runAction("off");
      return json(r.code === 0 ? await state(r.out + "\n") : { error: r.out.split("\n").pop(), log: r.out });
    }
    send(404, "text/plain", "No encontrado");
  } catch (e) {
    json({ error: String(e) });
  }
});
server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `El panel ya está abierto (puerto ${PORT}). Abre http://127.0.0.1:${PORT}` : String(e));
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  const link = `http://127.0.0.1:${PORT}`;
  console.log(`\nPanel listo: ${link}\nDeja esta ventana abierta mientras lo uses. Ciérrala para apagar el panel.`);
  spawn("cmd", ["/c", "start", '""', link], { stdio: "ignore", detached: true }).unref();
});
