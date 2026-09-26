// Real-browser check (390px): the codex "Habitantes" tab with live states, and the copy button on scene messages. Needs `npm run dev` and a seeded DB.
// Usage: node scripts/residents-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

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
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `resi_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.fill('input[placeholder*="Roronoa"]', `Resi${Date.now() % 100000}`);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 30000 });

  await page.fill("textarea", "Miro a mi alrededor y respiro hondo el aire del puerto.");
  await page.click('button:has-text("Actuar")');
  // The scene's first message has a copy button that puts its text on the clipboard.
  await page.waitForSelector('[data-testid="copy-message"]', { timeout: 20000 });
  const first = page.locator('[data-testid="copy-message"]').first();
  await first.click();
  await page.waitForTimeout(300);
  check("the button confirms the copy", (await page.locator('[data-testid="copy-message"]:has-text("Copiado")').count()) > 0);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check("the clipboard holds the message text", clip.length > 20, clip);
  await page.screenshot({ path: path.join(shots, "residents-01-copy.png") });

  // Codex tab with the residents.
  execSync("npx tsx scripts/kill-a-guard.ts", { encoding: "utf8" });
  await page.goto(`${BASE}/codex`);
  await page.click('[data-testid="codex-tab-residents"]');
  await page.waitForSelector('[data-testid="residents-section"] [data-testid="resident-card"]', { timeout: 20000 });
  const cards = await page.locator('[data-testid="resident-card"]').count();
  check("residents are listed by island", cards > 100 && (await page.locator('[data-testid="residents-island"]').count()) >= 40, String(cards));
  check("states show as live badges", (await page.locator('[data-testid="resident-state"]').first().textContent())?.length > 3);
  await page.fill('[data-testid="residents-search"]', "taberna");
  const filtered = await page.locator('[data-testid="resident-card"]').count();
  check("search filters residents by job", filtered > 0 && filtered < cards, `${filtered}/${cards}`);
  await page.fill('[data-testid="residents-search"]', "");
  await page.click('[data-testid="residents-dead"]');
  await page.waitForSelector('[data-testid="resident-card"]');
  check("the dead are listed apart with how they died", /muerto a manos de Prueba/.test(await page.locator('[data-testid="residents-section"]').textContent()));
  await page.screenshot({ path: path.join(shots, "residents-02-codex.png"), fullPage: false });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 390 + 2);
  check("no horizontal overflow at 390px", !overflow);
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
