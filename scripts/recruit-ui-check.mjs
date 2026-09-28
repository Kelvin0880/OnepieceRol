// Real-browser check of the recruit flow (2026-09-27): the island's residents list a "Reclutar (n/3)" button, a special
// recruit is marked with its story hook, and clicking the button writes the invitation into the action box (nothing is sent).
// Needs `npm run dev` and a freshly seeded DB. Usage: node scripts/recruit-ui-check.mjs
import { chromium } from "playwright";
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

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 1400 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `rec_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "Reclutador");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="island-people"]', { timeout: 30000 });
  if (await page.locator('[data-testid="people-tab-residents"]').count()) await page.click('[data-testid="people-tab-residents"]');
  await page.waitForSelector('[data-testid="cast-entry"]');

  const buttons = page.locator('[data-testid="cast-recruit"]');
  check("residents can be recruited from the list", (await buttons.count()) > 0);
  check("the button shows the crew count", (await buttons.first().textContent()).includes("0/3"));
  const special = page.locator('[data-testid="cast-special"]');
  check("a special recruit is marked with its story hook", (await special.count()) > 0 && (await special.first().textContent()).includes("Especial"));
  check("the hint never shows exact numbers", !/\d{3,}/.test(await special.first().textContent()));
  await page.screenshot({ path: path.join(shotsDir, "recruit-01-list.png"), fullPage: true });

  const entry = page.locator('[data-testid="cast-entry"]').filter({ has: page.locator('[data-testid="cast-special"]') }).first();
  const name = (await entry.locator("span.text-sm").first().textContent()).split("·")[0].trim();
  await entry.locator('[data-testid="cast-recruit"]').click();
  const box = page.locator('[data-testid="composer"] textarea').first();
  const written = await box.inputValue();
  check("clicking Reclutar writes the invitation into the action box", written.includes(name) && written.includes("únete a mi tripulación"));
  await page.screenshot({ path: path.join(shotsDir, "recruit-02-composer.png"), fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - 390);
  check(`no horizontal overflow at 390px (${overflow}px)`, overflow <= 1);
  if (errors.length) {
    console.log("console errors:", errors);
    failures++;
  }
  await context.close();
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
