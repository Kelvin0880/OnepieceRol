// Live verification for the grudge/memory system's UI surface: forces a
// deterministic grudge-ambush encounter (scripts/force-grudge-ambush.ts)
// against Marshall D. Teach's lieutenant and confirms it renders correctly
// — enemy name, HP bar, no console errors — then drives one combat round to
// confirm the encounter is real and playable. Narration prose itself isn't
// asserted (non-deterministic AI text), same scope as combat-rounds-check.mjs.
// Requires `npm run dev` running. Usage: node scripts/grudge-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(label, cond) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

const username = "grudgetest" + (Date.now() % 100000);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(e.message));

try {
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "GrudgeTester");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 10000 });

  const url = page.url();
  const characterId = url.split("/play/")[1];
  console.log("characterId:", characterId);

  execSync(`npx tsx scripts/force-grudge-ambush.ts ${characterId}`, { stdio: "inherit" });
  await page.reload();
  await page.waitForSelector("text=Te enfrentas a", { timeout: 10000 });
  await page.screenshot({ path: path.join(shotsDir, "grudge-01-ambush.png"), fullPage: true });

  check("grudge-ambush encounter shows the lieutenant's name", await page.locator("text=Lugarteniente de Barbanegra").first().isVisible().catch(() => false));
  const hpBefore = await page.locator("text=320/320").isVisible().catch(() => false);
  check("enemy starts at the reused snapshot's full HP (320/320)", hpBefore);

  await page.fill("textarea", "Desenfundo mi arma y me preparo para el segundo asalto.");
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 60000 }).catch(() => {});
  await page.waitForSelector("text=narrando...", { state: "hidden", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(shotsDir, "grudge-02-round1.png"), fullPage: true });

  const stillInEncounter = await page.locator("text=Sigues luchando contra").or(page.locator("text=está derrotado")).isVisible().catch(() => false);
  check("combat round resolved into either an ongoing fight or a win — not stuck", stillInEncounter);

  check("no console/page errors during the grudge-ambush encounter", consoleErrors.length === 0);
  if (consoleErrors.length > 0) console.log("errors:", consoleErrors);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  failures++;
} finally {
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
