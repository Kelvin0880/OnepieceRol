// Real-browser check: the "Rumbo" menu, a long crossing, arrival and a sea ambush, on a phone-sized screen. Needs `npm run dev`.
// Usage: node scripts/voyage-ui-check.mjs
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
  const name = `Voy${Date.now() % 100000}`;
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `voy_${Date.now() % 100000000}`);
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

  // ---- a low-level character sees why the menu is closed
  await page.click('[data-testid="voyage-open"]');
  await page.waitForSelector('[data-testid="voyage-panel"]');
  await page.waitForSelector('[data-testid="voyage-panel"] >> text=nivel 20');
  check("below level 20 the menu explains the unlock", (await page.textContent('[data-testid="voyage-panel"]')).includes("nivel 20"));
  await page.screenshot({ path: path.join(shots, "voyage-01-locked.png"), fullPage: true });
  await page.click('button:has-text("Cerrar")');

  // ---- the owner tool makes this character a Yonko; the menu opens up
  console.log(tsx(`scripts/make-yonko.ts "${name}"`).trim().split("\n").pop());
  await page.reload();
  await page.waitForSelector('[data-testid="voyage-open"]');
  await page.click('[data-testid="voyage-open"]');
  await page.waitForSelector('[data-testid="voyage-option"]');
  await fits("voyage menu");
  check("the menu shows the current location", (await page.textContent('[data-testid="voyage-from"]')).includes("Toro Negro"));
  const count = await page.locator('[data-testid="voyage-option"]').count();
  check("it lists many destinations with times and risk", count >= 20 && (await page.textContent('[data-testid="voyage-list"]')).includes("min") && (await page.textContent('[data-testid="voyage-list"]')).includes("Riesgo"), String(count));
  await page.screenshot({ path: path.join(shots, "voyage-02-menu.png"), fullPage: true });
  await page.fill('[data-testid="voyage-search"]', "Wano");
  check("searching narrows the list", (await page.locator('[data-testid="voyage-option"]').count()) === 1);
  await page.click('[data-testid="voyage-pick"]');
  await page.screenshot({ path: path.join(shots, "voyage-03-confirm.png"), fullPage: true });
  await page.click('[data-testid="voyage-confirm"]');
  await page.waitForSelector('[data-testid="voyage-notice"]');
  check("sailing starts a timed crossing", (await page.textContent('[data-testid="voyage-notice"]')).includes("rumbo a"));
  await page.waitForSelector('[data-testid="voyage-active"]');
  await page.screenshot({ path: path.join(shots, "voyage-04-at-sea.png"), fullPage: true });
  await page.click('button:has-text("Cerrar")');
  await page.waitForSelector('[data-testid="voyage-banner"]');
  check("the play screen shows the crossing banner", (await page.textContent('[data-testid="voyage-banner"]')).includes("En alta mar"));
  await fits("play screen at sea");
  await page.screenshot({ path: path.join(shots, "voyage-05-banner.png"), fullPage: true });

  // ---- arrival with a sea ambush
  tsx(`scripts/voyage-setup.ts ambush "${name}"`);
  await page.reload();
  await page.waitForFunction(() => document.body.textContent.includes("Rey del Mar") || document.body.textContent.includes("Wano"), null, { timeout: 20000 });
  check("the banner is gone after landing", (await page.locator('[data-testid="voyage-banner"]').count()) === 0);
  check("the ambush shows as a fight waiting at port", (await page.textContent("body")).includes("Rey del Mar"));
  check("the character is now in Wano", (await page.textContent("body")).includes("Wano"));
  await fits("play screen after the ambush");
  await page.screenshot({ path: path.join(shots, "voyage-06-ambush.png"), fullPage: true });
  await page.click('[data-testid="inventory-open"]');
  await page.waitForSelector('[data-testid="inventory-panel"]');
  await page.click('[data-testid="inv-tab-shop"]');
  check("the Wano merchant sells its local sake", (await page.textContent('[data-testid="inv-shop"]')).includes("Sake de Wano") && (await page.textContent('[data-testid="inv-shop"]')).includes("especialidad local"));
  await fits("specialty shop");
  await page.screenshot({ path: path.join(shots, "voyage-07-specialty-shop.png"), fullPage: true });
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.log("ERROR:", e.message);
  failures++;
  await page.screenshot({ path: path.join(shots, "voyage-error.png"), fullPage: true }).catch(() => {});
}
await browser.close();
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
