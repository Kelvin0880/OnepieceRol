// Visual tour (2026-09-25): registers a throwaway account, creates a character and screenshots every main
// screen at phone (390) and desktop (1280) widths, checking for horizontal overflow and page errors.
// Also forces a fight so the combat panel is covered. Needs `npm run dev`.
// Usage: node scripts/design-tour.mjs [label]   (screens land in shots/tour-<label>-*.png)
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const label = process.argv[2] ?? "now";
const BASE = "http://localhost:3000";
const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(cond ? `PASS: ${name}` : `FAIL: ${name} ${extra}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const user = `tour_${Date.now() % 100000000}`;
const charName = `Tour${Date.now() % 100000}`;
let characterId = null;

async function run(width) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = (n, fullPage = true) => page.screenshot({ path: path.join(shots, `tour-${label}-${width}-${n}.png`), fullPage });
  const fits = async (n) => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`${n} fits ${width}px`, sw <= width + 1, `(scrollWidth ${sw})`);
  };

  await page.goto(BASE);
  await page.waitForSelector('button:has-text("Crear cuenta")');
  await shot("01-login");
  await fits("login");
  if (!characterId) {
    await page.click('button:has-text("Crear cuenta")');
    await page.fill('input[placeholder="Nombre de usuario"]', user);
    await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
    await page.click('form button:has-text("Crear cuenta")');
  } else {
    await page.fill('input[placeholder="Nombre de usuario"]', user);
    await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
    await page.click('form button[type="submit"]');
  }
  await page.waitForSelector("text=Tus personajes");
  if (!characterId) {
    await page.click('a:has-text("Nuevo personaje")');
    await page.waitForSelector("text=Comienza tu leyenda");
    await shot("02-create");
    await fits("create");
    await page.fill('input[placeholder*="Roronoa"]', charName);
    await page.click('button:has-text("Pirata")');
    await page.click('button:has-text("Espadachín")');
    await page.click('button:has-text("Zarpar")');
    await page.waitForURL(/\/play\//, { timeout: 30000 });
    characterId = page.url().split("/play/")[1];
    await page.goto(BASE);
    await page.waitForSelector("text=Tus personajes");
  } else {
    await page.goto(`${BASE}/create`);
    await page.waitForSelector("text=Comienza tu leyenda");
    await shot("02-create");
    await fits("create");
    await page.goto(BASE);
    await page.waitForSelector("text=Tus personajes");
  }
  await page.waitForTimeout(400);
  await shot("03-characters");
  await fits("character list");

  await page.goto(`${BASE}/play/${characterId}`);
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  await page.waitForTimeout(600);
  await shot("04-play");
  await fits("play");

  execSync(`npx tsx scripts/force-threat-encounter.ts ${characterId}`, { stdio: "ignore" });
  await page.reload();
  await page.waitForSelector("text=Bandido de poca monta", { timeout: 30000 });
  await page.waitForTimeout(400);
  await shot("05-threat");
  await fits("threat");

  for (const [tid, n] of [["inventory-open", "06-inventory"], ["crew-open-header", "07-crew"], ["voyage-open", "08-voyage"]]) {
    const btn = page.locator(`[data-testid="${tid}"]`).first();
    if (!(await btn.isVisible())) {
      const menu = page.locator('[data-testid="nav-menu"]');
      if (await menu.count()) await menu.click();
    }
    await page.locator(`[data-testid="${tid}"]`).first().click();
    await page.waitForTimeout(700);
    await shot(n, false);
    await fits(n);
    await page.keyboard.press("Escape");
    const close = page.locator('button:has-text("Cerrar")').first();
    if (await close.isVisible().catch(() => false)) await close.click();
    await page.waitForTimeout(300);
  }

  for (const [url, n, sel] of [["/news", "09-news", "h1"], ["/codex", "10-codex", "h1"]]) {
    await page.goto(`${BASE}${url}`);
    await page.waitForSelector(sel);
    await page.waitForTimeout(1200);
    await shot(n);
    await fits(n);
  }
  check(`no page errors at ${width}px`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}

try {
  await run(390);
  await run(1280);
} catch (e) {
  failures++;
  console.log("FAIL: tour crashed", e.message);
} finally {
  await browser.close();
  if (characterId) console.log("characterId", characterId);
  console.log(failures === 0 ? "PASS design tour" : `FAIL design tour (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}
