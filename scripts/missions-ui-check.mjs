// Real-browser check of island missions + AI briefing for every starting faction (2026-09-24).
// Needs `npm run dev` and an OpenRouter key. Usage: node scripts/missions-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond) => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
};

const FACTIONS = [
  ["Pirata", "pir"],
  ["Marine", "mar"],
  ["Revolucionario", "rev"],
  ["Cazarrecompensas", "caz"],
  ["CP-0", "cp0"],
];

try {
  for (const [label, tag] of FACTIONS) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:3000");
    await page.click('button:has-text("Crear cuenta")');
    await page.fill('input[placeholder="Nombre de usuario"]', `${tag}_${Date.now() % 100000000}`);
    await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
    await page.click('form button:has-text("Crear cuenta")');
    await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
    await page.click('a:has-text("Nuevo personaje")');
    await page.waitForSelector("text=Comienza tu leyenda");
    await page.fill('input[placeholder*="Roronoa"]', `Pj ${tag}`);
    await page.click(`button:has-text("${label}")`);
    await page.click('button:has-text("Espadachín")');
    await page.click('button:has-text("Zarpar")');
    await page.waitForSelector('[data-testid="missions-panel"]', { timeout: 30000 });
    const missions = await page.locator('[data-testid="mission"]').count();
    check(`${label}: three missions are offered on the starting island`, missions === 3);
    // The AI panorama arrives asynchronously; the panel refreshes itself.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="island-briefing"]');
      return el && !el.textContent.includes("reuniendo el panorama");
    }, null, { timeout: 90000 });
    const briefing = await page.textContent('[data-testid="island-briefing"]');
    check(`${label}: the island panorama is explained (${briefing.length} chars)`, briefing.length > 200);
    await page.screenshot({ path: path.join(shotsDir, `missions-${tag}.png`), fullPage: true });
    if (errors.length) {
      console.log("console errors:", errors);
      failures++;
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `FAILED (${failures})` : "ALL PASSED");
process.exit(failures ? 1 : 0);
