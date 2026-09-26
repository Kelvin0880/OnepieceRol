// Real-browser check (2026-09-26) of the seats of command on a phone (390 px): a new marine sees the "Almirantes" tab with
// what is missing; staged at Nuevo Marineford they challenge Kizaru, win, and become Almirante (header + panel); then the
// world challenges them and the alert + answer buttons work (accept opens the fight). Also the revolutionary and CP-0 tabs.
// Needs `npm run dev` started with JUDGE_STUB=1 REFEREE_STUB=1 and a fresh seeded DB. Usage: node scripts/seats-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label} ${extra}`);
  if (!cond) failures++;
};
const browser = await chromium.launch();
const W = 390;

async function newPlayer(faction, name) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `seatui_${Date.now() % 1e8}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click(`button:has-text("${faction}")`);
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  return { ctx, page, errors };
}
const fits = async (page, label) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${label} fits ${W}px`, sw <= W + 1, `(scrollWidth ${sw})`);
};
const openPower = async (page) => {
  await page.click('[data-testid="power-open"]');
  await page.waitForSelector('[data-testid="sov-seats"]');
};
const closePanel = (page) => page.click('[data-testid="sovereignty-panel"] button:has-text("Cerrar")');

try {
  // ---------- Marine: requirements, challenge, promotion
  const name = `Almirante${Date.now() % 100000}`;
  const m = await newPlayer("Marine", name);
  await openPower(m.page);
  check("a marine opens Poder on the Almirantes tab", (await m.page.textContent('[data-testid="sov-tab-seats"]')).includes("Almirantes"));
  const tiers = await m.page.locator('[data-testid="seat-tier"]').allTextContents();
  check("both posts are listed: Almirante de Flota 1/1 and Almirante 3/3", tiers.some((t) => t.includes("Almirante de Flota") && t.includes("1/1")) && tiers.some((t) => /^Almirante\d/.test(t.replace(/\s+/g, "")) || (t.includes("3/3") && !t.includes("Flota"))));
  const reqText = await m.page.textContent('[data-testid="seat-requirements"]');
  check("a recruit sees exactly what is missing (level, merit)", reqText.includes("Nivel 40") && reqText.includes("mérito"));
  check("challenge buttons are disabled for a recruit", await m.page.locator('[data-testid="seat-challenge"]').first().isDisabled());
  await m.page.screenshot({ path: path.join(shots, "seats-01-recruit-390.png"), fullPage: true });
  await fits(m.page, "seats panel (recruit)");
  await closePanel(m.page);

  execSync(`npx tsx scripts/seats-setup.ts stage "${name}"`, { stdio: "ignore" });
  await m.page.reload();
  await m.page.waitForSelector('[data-testid="xp-bar"]');
  await openPower(m.page);
  const kizaruRow = m.page.locator('[data-testid="seat-holder"]', { hasText: "Kizaru" });
  check("at Nuevo Marineford the challenge to Kizaru is enabled", !(await kizaruRow.locator('[data-testid="seat-challenge"]').isDisabled()));
  await m.page.screenshot({ path: path.join(shots, "seats-02-eligible-390.png"), fullPage: true });
  await kizaruRow.locator('[data-testid="seat-challenge"]').click();
  await m.page.waitForSelector('[data-testid="seat-notice"]');
  check("the challenge is confirmed in plain words", (await m.page.textContent('[data-testid="seat-notice"]')).includes("Kizaru"));
  await closePanel(m.page);
  await m.page.reload();
  const fightShown = await m.page.waitForSelector("text=Duelo por el puesto contra Kizaru", { timeout: 20000 }).then(() => true).catch(() => false);
  check("the one-on-one fight appears on the play screen, titled as a seat duel", fightShown);
  await m.page.screenshot({ path: path.join(shots, "seats-03-fight-390.png"), fullPage: true });

  execSync(`npx tsx scripts/seats-setup.ts win "${name}"`, { stdio: "ignore" });
  await m.page.reload();
  await m.page.waitForSelector('[data-testid="xp-bar"]');
  check("the header now reads Almirante", (await m.page.textContent('[data-testid="play-header"]')).includes("Almirante"));
  await openPower(m.page);
  check("the panel says you are Almirante", (await m.page.textContent('[data-testid="seat-mine"]')).includes("Eres Almirante"));
  await m.page.screenshot({ path: path.join(shots, "seats-04-admiral-390.png"), fullPage: true });
  await closePanel(m.page);

  // ---------- The world challenges the new admiral
  execSync(`npx tsx scripts/seats-setup.ts challenged "${name}"`, { stdio: "ignore" });
  await m.page.reload();
  await m.page.waitForSelector('[data-testid="seat-challenge-alert"]', { timeout: 15000 });
  check("an alert on the play screen says you were challenged", (await m.page.textContent('[data-testid="seat-challenge-alert"]')).includes("24 h"));
  await m.page.screenshot({ path: path.join(shots, "seats-05-alert-390.png"), fullPage: true });
  await m.page.click('[data-testid="seat-challenge-alert"]');
  await m.page.waitForSelector('[data-testid="seat-incoming"]');
  const incoming = await m.page.textContent('[data-testid="seat-incoming"]');
  check("the challenge explains the stakes (refusing loses the seat)", incoming.includes("pierdes el puesto"));
  await m.page.click('[data-testid="seat-refuse"]');
  check("refusing asks for confirmation first", (await m.page.locator('[data-testid="seat-refuse-confirm"]').count()) === 1);
  await m.page.screenshot({ path: path.join(shots, "seats-06-incoming-390.png"), fullPage: true });
  await m.page.click('[data-testid="seat-accept"]');
  await m.page.waitForSelector('[data-testid="seat-notice"]');
  check("accepting brings the challenger to fight", (await m.page.textContent('[data-testid="seat-notice"]')).includes("Defiende tu puesto"));
  await fits(m.page, "seats panel (defending)");
  check("no page errors (marine)", m.errors.length === 0, m.errors.join(" | "));
  await m.ctx.close();

  // ---------- Revolutionary and CP-0 ladders
  const r = await newPlayer("Revolucionario", `Rebelde${Date.now() % 100000}`);
  await openPower(r.page);
  const rTiers = (await r.page.locator('[data-testid="seat-tier"]').allTextContents()).join(" | ");
  check("a revolutionary sees Líder, Jefe de Estado Mayor and Comandante", rTiers.includes("Líder") && rTiers.includes("Jefe de Estado Mayor") && rTiers.includes("Comandante"));
  await r.page.screenshot({ path: path.join(shots, "seats-07-revolution-390.png"), fullPage: true });
  await r.page.click('[data-testid="sov-tab-war"]');
  check("the war tab explains who can declare war on the Government", (await r.page.textContent('[data-testid="sov-war"]')).includes("Líder o el Jefe de Estado Mayor"));
  check("no page errors (revolutionary)", r.errors.length === 0, r.errors.join(" | "));
  await r.ctx.close();

  const cp = await newPlayer("CP-0", `Agente${Date.now() % 100000}`);
  await openPower(cp.page);
  check("a CP-0 agent sees the five Elders", (await cp.page.textContent('[data-testid="sov-seats"]')).includes("5/5"));
  await cp.page.screenshot({ path: path.join(shots, "seats-08-gorosei-390.png"), fullPage: true });
  await cp.ctx.close();

  // ---------- News
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 } });
  const news = await ctx.newPage();
  await news.goto(`${BASE}/news`);
  await news.click('button:has-text("Rangos y mandos")');
  const promoted = await news.waitForSelector("text=nuevo Almirante", { timeout: 20000 }).then(() => true).catch(() => false);
  check("the news has the 'Rangos y mandos' section with the promotion", promoted);
  await news.screenshot({ path: path.join(shots, "seats-09-news-390.png"), fullPage: false });
  await ctx.close();
} catch (err) {
  console.error(err);
  failures++;
}
await browser.close();
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
