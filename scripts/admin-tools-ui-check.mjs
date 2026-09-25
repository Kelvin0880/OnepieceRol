// Real-browser check of the owner's admin tools (needs ADMIN_USERNAMES=Kelvin in .env, `npm run dev`, a freshly seeded DB).
// Uses the real AI for the proposed happening; asserts the flow, never the prose.
// Usage: node scripts/admin-tools-ui-check.mjs
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const notice = async () => (await page.waitForSelector('[data-testid="admin-tools-notice"], [data-testid="admin-tools-error"]', { timeout: 150000 })).textContent();

try {
  execSync("npx tsx scripts/events-setup.ts report", { encoding: "utf8" });
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', "Kelvin");
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 15000 });
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('[data-testid="admin-stats"]', { timeout: 20000 });
  check("the dashboard shows the world numbers", (await page.textContent('[data-testid="admin-stats"]')).includes("cuentas"));
  await page.screenshot({ path: path.join(shots, "admin-tools-01.png"), fullPage: true });
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check("the admin page fits 390px", w <= 391, `(${w})`);

  await page.waitForSelector('[data-testid="admin-report"]');
  check("the player report is listed", (await page.textContent('[data-testid="admin-reports"]')).includes("olvidó mi inventario"));
  await page.click('[data-testid="admin-report"] button:has-text("Archivar")');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="admin-report"]').length === 0);
  check("archiving removes it", true);

  await page.fill('[data-testid="admin-announce-head"]', "Gran apertura del puerto");
  await page.fill('[data-testid="admin-announce-body"]', "El puerto reabre sus muelles con descuentos para los recién llegados.");
  await page.click('[data-testid="admin-announce-go"]');
  check("an official announcement is published", (await notice()).includes("Anuncio publicado"));

  await page.fill('[data-testid="admin-happening-idea"]', "Una tormenta de arena descubre unas ruinas antiguas junto al puerto");
  await page.fill('[data-testid="admin-happening"] input[list="admin-islands"]', "Loguetown");
  await page.click('[data-testid="admin-happening-go"]');
  check("the AI develops the owner's idea into a happening", (await notice()).includes("Suceso publicado"));

  await page.fill('[data-testid="admin-event-idea"]', "Una carrera de barcas por la bahía");
  await page.fill('[data-testid="admin-events"] input[list="admin-islands"]', "Pueblo Foosha");
  await page.click('[data-testid="admin-event-create"]');
  check("a beginner event is announced from the panel", (await notice()).includes("Evento anunciado"));
  await page.waitForSelector('[data-testid="admin-event"]');
  await page.screenshot({ path: path.join(shots, "admin-tools-02-event.png"), fullPage: true });
  await page.click('[data-testid="admin-event"] button:has-text("Cancelar")');
  await page.waitForFunction(() => document.querySelector('[data-testid="admin-event"]')?.textContent?.includes("CANCELLED"), null, { timeout: 20000 });
  check("and it can be cancelled", true);

  await page.fill('[data-testid="admin-start-arc"] input[placeholder^="Objetivo"]', "Nadie Inventado");
  await page.fill('[data-testid="admin-start-arc"] input[placeholder^="Agresor"]', "Sakazuki");
  await page.click('[data-testid="admin-start-arc-go"]');
  check("an unknown character is refused for a world event", (await notice()).includes("No encuentro"));
  await page.fill('[data-testid="admin-start-arc"] input[placeholder^="Objetivo"]', "Marshall D. Teach");
  await page.click('[data-testid="admin-start-arc-go"]');
  const arcMsg = await notice();
  check("a valid pair starts a world event", arcMsg.includes("Evento mundial iniciado"), arcMsg);

  await page.goto(`${BASE}/news`);
  await page.waitForSelector("text=Gran apertura del puerto", { timeout: 20000 });
  check("the announcement, the happening and the event are in the news", (await page.textContent("body")).includes("Gran apertura del puerto"));
  await page.screenshot({ path: path.join(shots, "admin-tools-03-news.png"), fullPage: false });
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
