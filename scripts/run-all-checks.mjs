// Full regression runner (2026-09-24): unit tests + tsc, then every DB check and every browser check, resetting the
// dev DB where a script needs a clean world. Writes a summary to shots/regression.log. Slow on purpose: many of
// these call the real AI. Usage: node scripts/run-all-checks.mjs [--quick]
import { spawnSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

const quick = process.argv.includes("--quick");
const logFile = path.resolve(process.cwd(), "shots", "regression.log");
fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(logFile, `Regression started ${new Date().toISOString()}\n`);
const log = (line) => {
  console.log(line);
  fs.appendFileSync(logFile, line + "\n");
};

const run = (cmd, args, timeoutMs) => {
  const r = spawnSync(cmd, args, { cwd: process.cwd(), shell: true, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? ""), timedOut: r.error?.code === "ETIMEDOUT" };
};

const killDev = () => run("powershell", ["-Command", '"Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"'], 20000);
async function startDev() {
  spawn("npm", ["run", "dev"], { cwd: process.cwd(), shell: true, detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://localhost:3000")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("dev server did not start");
}
async function freshWorld() {
  killDev();
  await new Promise((r) => setTimeout(r, 2500));
  const r = run("npm", ["run", "db:reset"], 180000);
  if (!r.out.includes("Seed complete")) throw new Error("db:reset failed:\n" + r.out.slice(-800));
  await startDev();
}

const results = [];
function record(name, r) {
  const fails = (r.out.match(/^FAIL/gm) ?? []).length + (r.out.match(/SCRIPT ERROR|Error:|FAILED/g) ?? []).length;
  const passed = r.code === 0 && !r.timedOut && !/FAIL:|FAILED|SCRIPT ERROR/.test(r.out);
  results.push({ name, ok: passed });
  log(`${passed ? "OK  " : "FAIL"} ${name}${r.timedOut ? " (timed out)" : ""}${passed ? "" : `\n${r.out.split("\n").filter((l) => /FAIL|Error|SCRIPT/.test(l)).slice(0, 6).join("\n")}`}`);
  return fails;
}

log("== unit tests + types");
record("vitest", run("npx", ["vitest", "run"], 300000));
record("tsc", run("npx", ["tsc", "--noEmit"], 300000));

const dbChecks = ["ooc-rollback", "world-arcs", "joint-fight", "guardian", "territory", "escape-buster", "consequence", "black-market", "missions", "grudge", "hunt", "impel", "compaction-travel", "prison-logic", "delete-character", "world-news", "raid", "attributes-inventory", "styles", "coliseum", "voyage"];
const browserFirst = ["battle-smoke", "crew-smoke", "ooc-crew-ui-check", "world-ui-check", "polish-ui-check", "features-ui-check", "voyage-ui-check"]; // need a clean DB each
const browserRest = quick ? [] : ["ai-e2e-smoke", "combat-rounds-check", "roleplay-attack-check", "duel-smoke", "party-multiplayer-smoke", "joint-fight-ui-check", "grudge-ui-check", "missions-ui-check", "realtime-check", "prison-ui-check", "raid-ui-check", "world-panels-ui-check", "check-news-page", "delete-character-ui-check"];

log("== DB checks");
await freshWorld();
for (const c of dbChecks) {
  const file = fs.existsSync(`scripts/${c}-check.ts`) ? `scripts/${c}-check.ts` : `scripts/${c}.ts`;
  record(c, run("npx", ["tsx", file], 600000));
}

log("== browser checks that need a clean world");
for (const c of browserFirst) {
  await freshWorld();
  record(c, run("node", [`scripts/${c}.mjs`], 600000));
}
log("== remaining browser checks");
await freshWorld();
for (const c of browserRest) record(c, run("node", [`scripts/${c}.mjs`], 600000));

killDev();
const bad = results.filter((r) => !r.ok);
log(`\nSUMMARY: ${results.length - bad.length}/${results.length} passed${bad.length ? ` — failing: ${bad.map((b) => b.name).join(", ")}` : ""}`);
run("npm", ["run", "db:reset"], 180000);
process.exit(bad.length ? 1 : 0);
