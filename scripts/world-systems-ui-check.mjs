// Real-browser check (390px) of the new world systems: admiral alert, prisoners in transit, island merchant,
// codex prisoners tab, Impel Down rescue panel and the admin selectors. Needs `npm run dev` (ADMIN_USERNAMES=Kelvin) and a freshly seeded DB.
// Usage: node scripts/world-systems-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
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
const browser = await chromium.launch();
const errors = [];
async function register(prefix) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', prefix === "Kelvin" ? "Kelvin" : `${prefix}_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  return page;
}
try {
  const name = `Mundo${Date.now() % 100000}`;
  const page = await register("mundo");
  await page.click('a:has-text("Nuevo personaje")');
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 30000 });
  const url = page.url();
  execSync(`npx tsx scripts/world-systems-setup.ts stage ${name}`, { encoding: "utf8" });
  await page.goto(url);

  await page.waitForSelector('[data-testid="admiral-alert"]', { timeout: 30000 });
  const countdown = await page.locator('[data-testid="admiral-countdown"]').textContent();
  check("the admiral alert shows a live countdown", /^\d\d:\d\d$/.test((countdown ?? "").trim()), String(countdown));
  check("the alert explains the two options", /zarpar antes de que llegue/.test(await page.locator('[data-testid="admiral-alert"]').textContent()));
  await page.screenshot({ path: path.join(shots, "world-01-alert.png"), fullPage: false });

  check("the captor sees the prisoners panel", (await page.locator('[data-testid="captives-panel"]').count()) === 1);
  check("delivery is disabled outside Government islands", await page.locator('[data-testid="captive-deliver"]').isDisabled());

  await page.click('button:has-text("Inventario")');
  await page.click('button:has-text("Mercader")');
  await page.waitForSelector('[data-testid="inv-shop"]');
  check("Jaya's merchant sells a Log Pose", (await page.locator('[data-testid="inv-buy-logpose"]').count()) === 1);
  check("no shop sells communication snails", (await page.locator('[data-testid="inv-buy-denden"]').count()) === 0);
  check("the armoury lists weapons", (await page.locator('[data-testid^="inv-buyweapon-"]').count()) >= 2);
  await page.screenshot({ path: path.join(shots, "world-02-merchant.png"), fullPage: true });
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/codex`);
  await page.click('[data-testid="codex-tab-prison"]');
  await page.waitForSelector('[data-testid="prison-section"]');
  await page.waitForFunction(() => /Kaido/.test(document.querySelector('[data-testid="prison-level-4"]')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {});
  check("Kaido shows in level 4 of Impel Down", /Kaido/.test(await page.locator('[data-testid="prison-level-4"]').textContent()));
  await page.screenshot({ path: path.join(shots, "world-03-codex-prison.png"), fullPage: true });

  execSync(`npx tsx scripts/world-systems-setup.ts impel ${name}`, { encoding: "utf8" });
  await page.goto(url);
  await page.waitForSelector('[data-testid="rescue-raid"]', { timeout: 30000 });
  const row = await page.locator('[data-testid="rescue-raid"]').textContent();
  check("the rescue panel lists Kaido with what the raid needs", /Kaido/.test(row ?? "") && /nivel 5\d\+/.test(row ?? ""), row ?? "");
  check("a lone player cannot start the deep rescue", await page.locator('[data-testid="rescue-start"]').first().isDisabled());
  await page.screenshot({ path: path.join(shots, "world-04-rescue.png"), fullPage: true });

  const admin = await register("Kelvin");
  await admin.goto(`${BASE}/admin`);
  await admin.waitForSelector('[data-testid="admin-start-arc"]', { timeout: 30000 });
  const arcSelects = await admin.locator('[data-testid="admin-start-arc"] select').count();
  check("world events pick characters from lists, not typed text", arcSelects >= 3 && (await admin.locator('[data-testid="admin-start-arc"] input').count()) === 0);
  const reclaim = await admin.locator('[data-testid="admin-start-arc"] option[value="reclaim"]').count();
  check("the owner can start a reclaim-the-throne event", reclaim === 1);
  check("the admiral launcher has its lists", (await admin.locator('[data-testid="admin-dispatch"] select').count()) === 2);
  await admin.screenshot({ path: path.join(shots, "world-05-admin.png"), fullPage: true });

  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
