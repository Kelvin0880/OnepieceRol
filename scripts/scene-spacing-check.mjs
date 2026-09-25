// Real-browser check: the player's own message keeps its line breaks and spaces in the scene bubble.
// Needs `npm run dev`. Usage: node scripts/scene-spacing-check.mjs
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
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const stamp = Date.now() % 100000;
try {
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `sp${stamp}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', `Espacio${stamp % 1000}`);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="scene-panel"]', { timeout: 30000 });

  const text = "— Primer párrafo con  doble espacio.\n\n— Segundo párrafo,\n    con sangría al inicio.";
  const box = page.locator("textarea").first();
  await box.fill(text);
  await page.click('button:has-text("Actuar")');
  const mine = page.locator('[data-testid="scene-panel"] .bubble-mine').last();
  await mine.waitFor({ timeout: 90000 });
  const rendered = await mine.evaluate((el) => ({ ws: getComputedStyle(el).whiteSpace, inner: el.innerText, raw: el.textContent }));
  console.log(JSON.stringify(rendered));
  check("bubble keeps whitespace (pre-wrap)", rendered.ws === "pre-wrap", rendered.ws);
  check("the stored text is identical to what was typed", rendered.raw === text, JSON.stringify(rendered.raw));
  check("blank line between paragraphs is visible", rendered.inner.includes("\n\n"));
  await page.screenshot({ path: path.join(shots, "scene-spacing.png"), fullPage: false });
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
