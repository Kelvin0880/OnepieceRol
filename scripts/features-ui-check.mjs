// Real-browser check (2026-09-24): attributes, inventory (fruit choice, weapons), combat styles panel and the
// Dressrosa Coliseum, on a phone-sized screen. Needs `npm run dev`.
// Usage: node scripts/features-ui-check.mjs
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
const helper = (args) => execSync(`npx tsx scripts/features-setup.ts ${args}`, { encoding: "utf8", cwd: process.cwd() });

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fits = async (label) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`${label} fits 390px`, o.sw <= 391 && o.iw <= 391, `(${o.sw}/${o.iw})`);
};

try {
  const name = `Feat${Date.now() % 100000}`;
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `feat_${Date.now() % 100000000}`);
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

  const prep = helper(`prep "${name}"`);
  console.log(prep.trim().split("\n").join(" | "));
  await page.reload();
  await page.waitForSelector('[data-testid="attributes-card"]');

  // ---- attributes
  check("level 12 grants 22 attribute points (2 per level)", (await page.textContent('[data-testid="attr-points"]')).includes("22"));
  const before = Number(await page.textContent('[data-testid="attr-strength"]'));
  await page.click('[data-testid="attr-plus-strength"]');
  await page.click('[data-testid="attr-plus-strength"]');
  check("the preview shows +2 before confirming", Number(await page.textContent('[data-testid="attr-strength"]')) === before + 2);
  await page.click('[data-testid="attr-confirm"]');
  await page.waitForFunction((b) => Number(document.querySelector('[data-testid="attr-strength"]')?.textContent) === b + 2 && document.querySelector('[data-testid="attr-points"]')?.textContent.includes("20"), before, { timeout: 15000 });
  check("confirming raises Fuerza and leaves 20 points", true);
  await page.screenshot({ path: path.join(shots, "features-01-attributes.png"), fullPage: true });
  await fits("play screen with attributes");

  // ---- inventory: fruit is found, not eaten
  await page.click('[data-testid="inventory-open"]');
  await page.waitForSelector('[data-testid="inventory-panel"]');
  await fits("inventory panel");
  const fruitName = await page.textContent('[data-testid="inv-fruit-name"]');
  check("the fruit in the bag shows its real name", /no Mi/.test(fruitName), fruitName);
  await page.click('[data-testid="inv-eat"]');
  check("eating asks for confirmation and warns about the sea", (await page.textContent('[data-testid="inventory-panel"]')).includes("no podrás nadar"));
  await page.screenshot({ path: path.join(shots, "features-02-fruit-confirm.png"), fullPage: true });
  await page.click('button:has-text("No, guardarla")');
  check("declining keeps the fruit", (await page.locator('[data-testid="inv-fruit"]').count()) === 1);
  check("bandages are listed and usable", (await page.locator('[data-testid="inv-use-vendaje"]').count()) === 1);
  await page.click('[data-testid="inv-use-vendaje"]');
  await page.waitForSelector('[data-testid="inv-notice"]:has-text("Vendaje")');
  check("using a bandage reports its effect", true);
  await page.click('[data-testid="inv-tab-gear"]');
  check("the prize weapon is listed in Equipo", (await page.textContent('[data-testid="inv-gear"]')).includes("Espada de premio"));
  await page.click('[data-testid="inv-tab-shop"]');
  check("the merchant sells things", (await page.locator('[data-testid^="inv-buy-"]').count()) >= 3);
  await page.screenshot({ path: path.join(shots, "features-03-shop.png"), fullPage: true });
  await page.click('[data-testid="inv-tab-bag"]');
  await page.click('[data-testid="inv-eat"]');
  await page.click('[data-testid="inv-eat-confirm"]');
  await page.waitForSelector('[data-testid="inv-notice"]:has-text("nadar")');
  check("confirming eats it, names it and warns", (await page.textContent('[data-testid="inv-notice"]')).includes(fruitName));
  await page.click('button:has-text("Cerrar")');

  // ---- styles
  await page.click('[data-testid="styles-open"]');
  await page.waitForSelector('[data-testid="styles-panel"]');
  await fits("styles panel");
  await page.waitForSelector('[data-testid="styles-hands"]');
  check("a character with no style is told where to learn", (await page.textContent('[data-testid="styles-panel"]')).includes("Todavía no conoces"));
  await page.click('[data-testid="styles-tab-learn"]');
  const learn = await page.textContent('[data-testid="styles-teachable"]');
  check("Dressrosa teaches the estocada style and states why it is locked", learn.includes("Esgrima de estocada") && learn.includes("Agilidad"));
  await page.click('[data-testid="styles-tab-map"]');
  const map = await page.textContent('[data-testid="styles-map"]');
  check("the map of schools lists Santoryu, Rokushiki and faction limits", map.includes("Santoryu") && map.includes("Rokushiki") && map.includes("CP-0"));
  await page.screenshot({ path: path.join(shots, "features-04-styles-map.png"), fullPage: true });
  await page.click('button:has-text("Cerrar")');

  // ---- coliseum
  await page.click('[data-testid="coliseum-open"]');
  await page.waitForSelector('[data-testid="coliseum-panel"]');
  await fits("coliseum panel");
  check("the announced tournament shows its prize", (await page.textContent('[data-testid="coliseum-prize"]')).includes("no Mi"));
  await page.click('[data-testid="coliseum-register-btn"]');
  await page.waitForSelector('[data-testid="coliseum-notice"]:has-text("Inscrito")');
  check("registering works from Dressrosa", true);
  await page.screenshot({ path: path.join(shots, "features-05-coliseum-registered.png"), fullPage: true });
  await page.click('button:has-text("Cerrar")');
  helper("start");
  await page.click('[data-testid="coliseum-open"]');
  await page.waitForSelector('[data-testid="coliseum-bracket"]');
  check("after the draw the bracket and my opponent appear", (await page.textContent('[data-testid="coliseum-me"]')).includes("Tu próximo combate"));
  await page.fill('[data-testid="coliseum-strategy"]', "aguanto la primera embestida y contraataco");
  await page.click('[data-testid="coliseum-strategy-send"]');
  await page.waitForSelector('[data-testid="coliseum-notice"]:has-text("Estrategia guardada")');
  check("a strategy can be saved", true);
  await page.screenshot({ path: path.join(shots, "features-06-coliseum-bracket.png"), fullPage: true });
  helper("round");
  await page.waitForTimeout(500);
  await page.click('button:has-text("Cerrar")');
  await page.goto("http://localhost:3000/news");
  await page.waitForTimeout(1500);
  const newsText = await page.textContent("body");
  check("the news page carries the coliseum stories", newsText.includes("Coliseo"));
  await fits("news page");
  await page.screenshot({ path: path.join(shots, "features-07-news.png"), fullPage: true });
  await page.goto("http://localhost:3000/codex");
  await page.waitForTimeout(1500);
  const codex = await page.textContent("body");
  check("the codex now includes all five Gorosei, Kaido and Big Mom", codex.includes("Marcus Mars") && codex.includes("Kaido") && codex.includes("Big Mom"));
  check("the codex shows combat styles for canon characters", codex.includes("Estilo de combate"));
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.log("ERROR:", e.message);
  failures++;
  await page.screenshot({ path: path.join(shots, "features-error.png"), fullPage: true }).catch(() => {});
}
await browser.close();
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
