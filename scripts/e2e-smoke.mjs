// End-to-end smoke test: registers an account, creates a character, plays
// through a fight-or-flee + mercy-choice combat, and checks the news feed.
// Requires the dev server running at localhost:3000 (`npm run dev`).
// Usage: node scripts/e2e-smoke.mjs — screenshots land in ./shots/.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
  console.log("screenshot:", name);
}

const username = "prueba_" + Date.now();

try {
  await page.goto("http://localhost:3000");
  await page.waitForSelector("text=Grand Line RPG");
  await shot("01-login.png");

  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await shot("02-register-filled.png");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await shot("03-home-loggedin.png");

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "Kaze Testigo");
  await page.click('button:has-text("Cazarrecompensas")');
  await page.click('button:has-text("Tirador")');
  await shot("04-create-character.png");
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Bitácora", { timeout: 10000 });
  await shot("05-play-screen.png");

  let combatFound = false;
  for (let i = 0; i < 12 && !combatFound; i++) {
    await page.click('button:has-text("Explorar")');
    await page.waitForTimeout(700);
    const pending = await page.locator('button:has-text("Luchar")').count();
    if (pending > 0) {
      combatFound = true;
      await shot("06-combat-choice.png");
    }
  }

  if (combatFound) {
    await page.click('button:has-text("Luchar")');
    await page.waitForTimeout(700);
    await shot("07-after-fight.png");
    const mercyCount = await page.locator('button:has-text("Perdonar")').count();
    if (mercyCount > 0) {
      await shot("08-mercy-choice.png");
      await page.click('button:has-text("Rematar")');
      await page.waitForTimeout(700);
      await shot("09-after-mercy.png");
    } else {
      console.log("No mercy choice appeared (likely lost the fight or died) — check screenshot 07.");
    }
  } else {
    console.log("No combat event triggered in 12 explores (random chance) — not necessarily a bug.");
  }

  await page.goto("http://localhost:3000/news");
  await page.waitForSelector("text=El Heraldo del Mundo");
  await page.waitForTimeout(500);
  await shot("10-news.png");

  console.log("DONE");
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  await shot("ERROR-state.png");
} finally {
  console.log("CONSOLE/PAGE ERRORS:", JSON.stringify(errors, null, 2));
  await browser.close();
}
