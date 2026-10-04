// Shichibukai in canon wars (2026-10-04), real browser at 390 px: a Warlord sees the Government's call on Poder > Guerra,
// the only button is "Acudir a la llamada del Gobierno" (the Marines' side, never the Emperor's), and answering it works.
// No AI call on this path. Requires `npm run dev` running. Usage: node scripts/warlord-call-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
function check(label, cond) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

const W = 390;
const name = "Shichi" + (Date.now() % 100000);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', name);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 15000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  const id = page.url().split("/play/")[1];

  const setup = JSON.parse(execSync(`npx tsx scripts/warlord-call-setup.ts ${id}`, { encoding: "utf8" }).trim().split("\n").pop());
  await page.reload();
  await page.waitForSelector('[data-testid="power-open"]', { timeout: 20000 });
  await page.click('[data-testid="power-open"]');
  await page.click('[data-testid="sov-tab-war"]');
  await page.waitForSelector('[data-testid="world-war"]', { timeout: 15000 });

  check("the Government's call is shown", (await page.locator('[data-testid="war-government-call"]').count()) === 1);
  const buttons = page.locator('[data-testid="war-enlist"]');
  check("exactly one option, on the Government's side", (await buttons.count()) === 1);
  const label = await buttons.first().innerText();
  check("it reads «Acudir a la llamada del Gobierno» and names the Marines, not the Emperor", label.includes("Acudir a la llamada del Gobierno") && label.includes("la Marina") && !label.includes(setup.attacker));
  check("fits 390 px", (await page.evaluate(() => document.documentElement.scrollWidth)) <= W + 1);
  await page.screenshot({ path: path.join(shots, "warlord-call-01.png"), fullPage: true });

  await buttons.first().click();
  await page.waitForSelector("text=Respondes a la llamada del Gobierno Mundial", { timeout: 15000 });
  check("answering the call is confirmed", true);
  await page.waitForSelector("text=Luchas en el bando de la Marina", { timeout: 15000 });
  check("the war now shows the Warlord on the Marines' side", true);
  await page.screenshot({ path: path.join(shots, "warlord-call-02.png"), fullPage: true });

  check("no page errors", errors.length === 0);
  if (errors.length) console.log(errors);
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  failures++;
} finally {
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
