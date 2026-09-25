// Real-browser check (390px) of the nakama controls in the crew panel: who comes along, "only this one", and missions.
// Needs `npm run dev`. Usage: node scripts/nakama-ui-check.mjs
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
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  const name = `Nak${Date.now() % 100000}`;
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `nak_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 30000 });
  execSync(`npx tsx scripts/empire-setup.ts give "${name}"`, { encoding: "utf8" });
  await page.reload();
  await page.waitForSelector('[data-testid="crew-open-header"]', { timeout: 30000 });
  await page.click('[data-testid="crew-open-header"]');
  await page.click('[data-testid="crew-tab-nakamas"]');
  await page.waitForSelector('[data-testid="nakama-card"]');
  const cards = page.locator('[data-testid="nakama-card"]');
  check("both nakamas are listed and come along by default", (await cards.count()) === 2 && (await page.locator('[data-testid="nakama-presence"]:has-text("Te acompaña")').count()) === 2);
  await page.screenshot({ path: path.join(shots, "nakama-01.png"), fullPage: true });

  const jorge = cards.filter({ hasText: "Jorge" });
  const yami = cards.filter({ hasText: "Yami Kessen" });
  await jorge.locator('[data-testid="nakama-toggle-stay"]').click();
  await jorge.locator('[data-testid="nakama-presence"]:has-text("Se queda en el barco")').waitFor();
  check("a nakama can stay on the ship", true);
  await jorge.locator('[data-testid="nakama-toggle-stay"]').click();
  await jorge.locator('[data-testid="nakama-presence"]:has-text("Te acompaña")').waitFor();
  check("and be called back", true);

  await yami.locator('[data-testid="nakama-only-this"]').click();
  await jorge.locator('[data-testid="nakama-presence"]:has-text("Se queda en el barco")').waitFor();
  check("\"Solo este me acompaña\" leaves the others on the ship", (await yami.locator('[data-testid="nakama-presence"]:has-text("Te acompaña")').count()) === 1);

  await yami.locator('[data-testid="nakama-mission-open"]').click();
  await yami.locator('[data-testid="nakama-missions"]').waitFor();
  await yami.locator('[data-testid="nakama-mission-scout"]').waitFor({ timeout: 20000 });
  const missions = await yami.locator('[data-testid="nakama-missions"]').textContent();
  check("missions are offered from the crew panel (patrol, tribute, scout)", missions.includes("Patrullar") && missions.includes("Cobrar tributos") && missions.includes("Explorar el mar"), missions);
  await page.screenshot({ path: path.join(shots, "nakama-02-missions.png"), fullPage: true });
  await jorge.locator('[data-testid="nakama-mission-open"]').click();
  await jorge.locator('[data-testid="nakama-mission-scout"]').click();
  await jorge.locator('[data-testid="nakama-away"]').waitFor({ timeout: 20000 });
  check("a nakama sent on a mission shows as away", (await jorge.textContent('[data-testid="nakama-away"]')).includes("En misión"));
  check("and cannot be re-assigned while away", (await jorge.locator('[data-testid="nakama-mission-open"]').count()) === 0);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check("the panel fits 390px", w <= 391, `(${w})`);
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
