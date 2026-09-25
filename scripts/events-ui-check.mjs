// Real-browser check (390px) of the Eventos panel and the "new" badges. Needs `npm run dev`; uses the real AI.
// The check asserts the flow (join, submit, verdict in the news, badges), never who wins or the prose.
// Usage: node scripts/events-ui-check.mjs
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
const stamp = Date.now() % 100000;
const browser = await chromium.launch();

async function newPlayer(tag, charName) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `ev${tag}${stamp}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 15000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', charName);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 20000 });
  page.charId = page.url().split("/play/")[1];
  return page;
}
const openEvents = async (p) => {
  await p.click('[data-testid="events-open"]');
  await p.waitForSelector('[data-testid="events-panel"]');
};

try {
  const a = await newPlayer("a", `Ana${stamp % 1000}`);
  const b = await newPlayer("b", `Beto${stamp % 1000}`);
  await a.waitForSelector('[data-testid="events-open"]');
  check("no badges on a fresh first visit", (await a.locator('[data-testid="badge-events"]').count()) === 0 && (await a.locator('[data-testid="badge-news"]').count()) === 0);

  const out = execSync("npx tsx scripts/events-setup.ts event", { encoding: "utf8", timeout: 180000 });
  check("an event was announced", out.includes("event "), out);

  await a.reload();
  await a.waitForSelector('[data-testid="badge-events"]', { timeout: 20000 });
  await a.waitForSelector('[data-testid="badge-news"]', { timeout: 20000 });
  check("the Eventos and Noticias buttons show something new", true);
  await a.screenshot({ path: path.join(shots, "events-01-badges.png"), fullPage: false });

  await openEvents(a);
  check("opening Eventos clears its badge", (await a.locator('[data-testid="badge-events"]').count()) === 0);
  await a.waitForSelector('[data-testid="event-card"]');
  await a.screenshot({ path: path.join(shots, "events-02-panel.png"), fullPage: true });
  const w = await a.evaluate(() => document.documentElement.scrollWidth);
  check("the panel fits 390px", w <= 391, `(${w})`);
  await a.click('[data-testid="event-join"]');
  await a.waitForSelector('[data-testid="event-text"]');
  check("after joining you can write your attempt", true);
  await a.fill('[data-testid="event-text"]', "Estudio el terreno con calma, uso mi espada para abrir paso y preparo una trampa sencilla antes de actuar.");
  await a.click('[data-testid="event-submit"]');
  await a.waitForSelector('[data-testid="event-waiting"]', { timeout: 20000 });
  check("the attempt is in and it waits for the rest (no time limit)", true);

  await b.reload();
  await openEvents(b);
  await b.click('[data-testid="event-join"]');
  await b.fill('[data-testid="event-text"]', "Me adelanto al resto: leo las corrientes, busco el atajo por las rocas y dejo un plan de reserva por si el primer intento falla, usando mi espada solo si hace falta. ".repeat(3));
  await b.click('[data-testid="event-submit"]');
  await b.waitForSelector('[data-testid="event-waiting"]', { timeout: 20000 });
  check("with the registration window still open, the event waits even though both finished", (await b.locator('[data-testid="event-result"]').count()) === 0);
  execSync("npx tsx scripts/events-setup.ts backdate", { encoding: "utf8" });
  await b.evaluate(() => fetch("/api/news"));
  await b.waitForFunction(async () => (await (await fetch(location.pathname.replace("/play/", "/api/characters/") + "/events")).json()).recent.length > 0, null, { timeout: 150000, polling: 3000 });
  await b.reload();
  await openEvents(b);
  await b.waitForSelector('[data-testid="event-result"]', { timeout: 20000 });
  check("when the last entrant finishes the verdict appears", true);
  await b.screenshot({ path: path.join(shots, "events-03-result.png"), fullPage: true });

  await a.reload();
  await openEvents(a);
  await a.waitForSelector('[data-testid="event-result"]', { timeout: 20000 });
  check("the other entrant sees the same verdict with their own score", (await a.textContent('[data-testid="event-result"]')).includes("Tu puntuación"));

  await a.goto(`${BASE}/news`);
  await a.waitForSelector("text=Resultado del evento", { timeout: 20000 });
  check("the whole process is in the news (result with winner)", true);
  await a.screenshot({ path: path.join(shots, "events-04-news.png"), fullPage: false });

  execSync(`npx tsx scripts/events-setup.ts item ${b.charId}`, { encoding: "utf8" });
  await b.goto(`${BASE}/play/${b.charId}`);
  await b.waitForSelector('[data-testid="badge-inventory"]', { timeout: 20000 });
  check("a new item shows a badge on Inventario", true);
  await b.click('[data-testid="inventory-open"]');
  await b.waitForTimeout(500);
  check("and it clears when opened", (await b.locator('[data-testid="badge-inventory"]').count()) === 0);
  check("no page errors", [a, b].every((p) => p.errors.length === 0), [a, b].flatMap((p) => p.errors).join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
