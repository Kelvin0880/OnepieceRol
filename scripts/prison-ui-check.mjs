// Verifies the prison UI renders correctly and the "Pagar fianza" button
// actually works through the real API route (not a direct function call).
// A real account is created via the browser, then force-captured via a
// small Prisma script (capture-by-combat is too RNG-dependent to trigger
// reliably here), then the SAME logged-in browser session is reloaded to
// confirm the jail view + bail flow work end to end.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("console error:", m.text());
});

const username = "jail" + Date.now().toString().slice(-10);

await page.goto("http://localhost:3000");
await page.waitForSelector("text=Grand Line RPG");
await page.click('button:has-text("Crear cuenta")');
await page.fill('input[placeholder="Nombre de usuario"]', username);
await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
await page.click('form button:has-text("Crear cuenta")');
await page.waitForSelector("text=Tus personajes");

await page.click('a:has-text("Nuevo personaje")');
await page.waitForSelector("text=Comienza tu leyenda");
await page.fill('input[placeholder*="Roronoa"]', "Preso De Prueba");
await page.click('button:has-text("Pirata")');
await page.click('button:has-text("Espadachín")');
await page.click('button:has-text("Zarpar")');
await page.waitForSelector("text=Bitácora");

const characterUrl = page.url();
const characterId = characterUrl.split("/play/")[1];
console.log("Character id:", characterId);

// Give the character enough berries to afford bail, then force-capture.
execSync(`npx tsx scripts/force-capture.ts ${characterId}`, { cwd: process.cwd(), stdio: "inherit" });

await page.reload();
await page.waitForSelector("text=Encarcelado en", { timeout: 10000 });
await page.screenshot({ path: path.join(shotsDir, "jail-view.png"), fullPage: true });

await page.click('button:has-text("Pagar fianza")');
await page.waitForSelector("text=Explorar", { timeout: 15000 });
await page.screenshot({ path: path.join(shotsDir, "after-bail.png"), fullPage: true });

const bodyText = await page.locator("body").innerText();
const freed = !bodyText.includes("Encarcelado en") && bodyText.includes("Explorar");
console.log("Freed after paying bail via real UI:", freed);
console.log(freed ? "PASS" : "FAIL — check screenshots");

await browser.close();
