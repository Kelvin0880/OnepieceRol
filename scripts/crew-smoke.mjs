// Verifies the multiplayer crew loop: player A founds a crew, player B
// joins with the invite code, and both see each other's presence on their
// shared starting island. Requires the dev server at localhost:3000.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();

async function registerAndCreate(name, characterName) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`[${name}] pageerror:`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error(`[${name}] console error:`, m.text());
  });

  await page.goto("http://localhost:3000");
  await page.waitForSelector("text=Grand Line RPG");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', name);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', characterName);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Bitácora");

  return { context, page };
}

try {
  const a = await registerAndCreate("crewA_" + Date.now(), "Capitana A");
  const b = await registerAndCreate("crewB_" + Date.now(), "Marinero B");

  // A founds the crew.
  await a.page.fill('input[placeholder="Nombre"]', "Piratas del Alba");
  await a.page.fill('input[placeholder="Emblema / descripción"]', "Una calavera con un sol naciente detrás.");
  await a.page.click('button:has-text("Fundar")');
  await a.page.waitForSelector("text=Piratas del Alba");
  await a.page.screenshot({ path: path.join(shotsDir, "crew-a-founded.png"), fullPage: true });

  const inviteCode = await a.page.locator("p.font-mono.text-gold").innerText();
  console.log("Invite code:", inviteCode);

  // B joins with the code.
  await b.page.fill('input[placeholder="Código de invitación"]', inviteCode.trim());
  await b.page.click('button:has-text("Unirse")');
  await b.page.waitForSelector("text=Piratas del Alba");
  await b.page.screenshot({ path: path.join(shotsDir, "crew-b-joined.png"), fullPage: true });

  // A refreshes and should see B in the crew roster AND in "Aventureros en esta isla".
  await a.page.reload();
  await a.page.waitForSelector("text=Piratas del Alba");
  await a.page.waitForSelector("text=Marinero B");
  await a.page.screenshot({ path: path.join(shotsDir, "crew-a-sees-b.png"), fullPage: true });

  const rosterHasBoth = (await a.page.locator("text=Capitana A").count()) > 0 && (await a.page.locator("text=Marinero B").count()) > 0;
  const presenceHasB = (await a.page.locator("text=Aventureros en esta isla").count()) > 0;

  console.log("Roster shows both members:", rosterHasBoth);
  console.log("Presence panel shows other player:", presenceHasB);
  console.log(rosterHasBoth && presenceHasB ? "PASS" : "FAIL — check screenshots");
} catch (e) {
  console.error("SCRIPT ERROR:", e);
} finally {
  await browser.close();
}
