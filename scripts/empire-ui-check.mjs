// Real-browser check of the "Imperio" panel (domains, troops, nakama errands) on a phone-sized screen. Needs `npm run dev`.
// Usage: node scripts/empire-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label} ${extra}`);
  if (!cond) failures++;
};
const tsx = (cmd) => execSync(`npx tsx ${cmd}`, { encoding: "utf8", cwd: process.cwd() });

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fits = async (label) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth }));
  check(`${label} fits 390px`, o.sw <= 391, `(${o.sw})`);
};

try {
  const name = `Imp${Date.now() % 100000}`;
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `imp_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="missions-panel"]', { timeout: 30000 });
  check("a fresh character has no Imperio button", (await page.locator('[data-testid="empire-open"]').count()) === 0);

  tsx(`scripts/empire-setup.ts give "${name}"`);
  await page.reload();
  await page.waitForSelector('[data-testid="empire-open"]', { timeout: 30000 });
  await page.click('[data-testid="empire-open"]');
  await page.waitForSelector('[data-testid="empire-domain"]');
  const text = await page.textContent('[data-testid="empire-panel"]');
  check("it lists the held island with its garrison", text.includes("Isla del Toro Negro") && text.includes("Debilitada") && text.includes("soldados"));
  check("it lists both nakamas, the commander with his epithet", (await page.locator('[data-testid="empire-commander"]').count()) === 2 && text.includes("Corta-Tormentas"));
  await fits("the empire panel");
  await page.screenshot({ path: path.join(shots, "empire-01-panel.png"), fullPage: true });

  // patrol: pick the domain
  await page.locator('[data-testid="empire-errand-patrol"]').first().click();
  await page.waitForSelector('[data-testid="empire-pick-domain"]');
  await page.click('[data-testid="empire-pick-domain"] button');
  await page.waitForSelector('[data-testid="empire-away"]');
  check("the commander is shown away on a patrol", (await page.textContent('[data-testid="empire-away"]')).includes("Patrullar"));
  await page.screenshot({ path: path.join(shots, "empire-02-away.png"), fullPage: true });

  // scout with the second nakama, then let both come home
  await page.locator('[data-testid="empire-commander"]').nth(1).locator('[data-testid="empire-errand-scout"]').click();
  await page.waitForSelector('[data-testid="empire-notice"]');
  check("the scout errand confirms", (await page.textContent('[data-testid="empire-notice"]')).includes("Explorar el mar"));
  tsx(`scripts/empire-setup.ts expire "${name}"`);
  await page.reload();
  await page.waitForSelector('[data-testid="empire-open"]');
  await page.click('[data-testid="empire-open"]');
  await page.waitForSelector('[data-testid="empire-reports"]');
  check("the finished errands leave reports and free both nakamas", (await page.locator('[data-testid="empire-away"]').count()) === 0 && (await page.locator('[data-testid="empire-reports"] li').count()) === 2);
  await fits("the empire reports");
  await page.screenshot({ path: path.join(shots, "empire-03-reports.png"), fullPage: true });

  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
