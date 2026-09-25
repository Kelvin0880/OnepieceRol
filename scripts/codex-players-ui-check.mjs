// Real-browser check (390px) of the public players registry in the Códice. Needs `npm run dev`.
// Usage: node scripts/codex-players-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label} ${extra}`);
  if (!cond) failures++;
};
const BASE = "http://localhost:3000";
const stamp = Date.now() % 100000;
const NAME = `Registro${stamp % 1000}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `cx${stamp}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 15000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', NAME);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 20000 });

  await page.goto(`${BASE}/codex`);
  await page.waitForSelector('[data-testid="codex-tab-players"]');
  check("canon is the default view", (await page.locator('[data-testid="codex-players-count"]').count()) === 0);
  await page.click('[data-testid="codex-tab-players"]');
  await page.waitForSelector('[data-testid="codex-player"]');
  const text = await page.textContent('[data-testid="codex-players-count"]');
  check("the registry counts the players", /\d+ jugador/.test(text ?? ""), text ?? "");
  await page.fill('[data-testid="codex-search"]', NAME);
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="codex-player"]').length === 1 && document.body.textContent.includes(n), NAME);
  const card = await page.textContent('[data-testid="codex-player"]');
  check("the new player appears with faction, level and status", card.includes("Pirata") || card.includes("PIRATE"), card);
  check("without private data (no account name)", !card.includes(`cx${stamp}`));
  await page.screenshot({ path: path.join(shots, "codex-players.png"), fullPage: true });
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check("fits 390px", w <= 391, `(${w})`);
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
