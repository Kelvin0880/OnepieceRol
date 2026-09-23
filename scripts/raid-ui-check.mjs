// Real-browser check of the final raid panel (2026-09-24). Needs `npm run dev`.
// Usage: node scripts/raid-ui-check.mjs
import { chromium } from "playwright";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond) => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
};
const fixture = (mode, id) => {
  const r = spawnSync("npx", ["tsx", "scripts/ui-fixture.ts", mode, id], { shell: true, encoding: "utf8" });
  if (!/fixture ok/.test(r.stdout)) throw new Error("fixture failed: " + r.stdout + r.stderr);
};

async function newPlayer(tag) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `${tag}_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', `Pj ${tag}`);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 15000 });
  const id = page.url().split("/play/")[1].split(/[?#]/)[0];
  return { page, id, errors };
}

try {
  const u = await newPlayer("una");
  fixture("raid-unaware", u.id);
  await u.page.reload();
  await u.page.waitForSelector('[data-testid="raid-panel"]', { timeout: 15000 });
  let txt = await u.page.textContent('[data-testid="raid-panel"]');
  check("someone who has not seen Laugh Tale is told the truth is missing", txt.includes("Laugh Tale") && !txt.includes("Reunir una coalición"));
  await u.page.screenshot({ path: path.join(shotsDir, "raid-unaware.png"), fullPage: true });

  const k = await newPlayer("kn");
  fixture("raid", k.id);
  await k.page.reload();
  await k.page.waitForSelector('[data-testid="raid-panel"]', { timeout: 15000 });
  check("a knower sees the muster button", (await k.page.textContent('[data-testid="raid-panel"]')).includes("Reunir una coalición"));
  await k.page.click('button:has-text("Reunir una coalición")');
  await k.page.waitForSelector("text=Abandonar la coalición", { timeout: 10000 });
  txt = await k.page.textContent('[data-testid="raid-panel"]');
  check("mustering lists me and shows the launch button", txt.includes("Coalición (1/20)") && txt.includes("Dar la orden de asalto"));
  await k.page.click('[data-testid="raid-launch"]');
  await k.page.waitForSelector("text=Hacen falta al menos 2", { timeout: 10000 });
  check("a lone player cannot storm the throne", true);
  await k.page.screenshot({ path: path.join(shotsDir, "raid-muster.png"), fullPage: true });
  for (const p of [u, k]) if (p.errors.length) { console.log("console errors:", p.errors); failures++; }
} finally {
  await browser.close();
}
console.log(failures ? `FAILED (${failures})` : "ALL PASSED");
process.exit(failures ? 1 : 0);
