// Verifies the N-vs-N crew battle loop end to end with 4 real accounts:
// two crews of 2 on the same starting island, a challenge with individually
// chosen matchups, the defending captain accepting, and a resolved result
// with a winner. Requires the dev server at localhost:3000.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();

async function registerAndCreate(label, characterName, archetype = "Espadachín") {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`[${label}] pageerror:`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error(`[${label}] console error:`, m.text());
  });

  await page.goto("http://localhost:3000");
  await page.waitForSelector("text=Grand Line RPG");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', label + "_" + Date.now());
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', characterName);
  await page.click('button:has-text("Pirata")');
  await page.click(`button:has-text("${archetype}")`);
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Bitácora");

  return { context, page, characterName };
}

try {
  const a1 = await registerAndCreate("a1", "Alfa Uno", "Espadachín");
  const a2 = await registerAndCreate("a2", "Alfa Dos", "Fuerza Bruta");
  const b1 = await registerAndCreate("b1", "Beta Uno", "Tirador");
  const b2 = await registerAndCreate("b2", "Beta Dos", "Luchador Cuerpo a Cuerpo");

  // Found crews.
  await a1.page.fill('input[placeholder="Nombre"]', "Crew Alfa " + Date.now());
  await a1.page.fill('input[placeholder="Emblema / descripción"]', "Bandera de prueba A");
  await a1.page.click('button:has-text("Fundar")');
  await a1.page.waitForSelector("text=Código de invitación");
  const codeA = (await a1.page.locator("p.font-mono.text-gold").innerText()).trim();

  await b1.page.fill('input[placeholder="Nombre"]', "Crew Beta " + Date.now());
  await b1.page.fill('input[placeholder="Emblema / descripción"]', "Bandera de prueba B");
  await b1.page.click('button:has-text("Fundar")');
  await b1.page.waitForSelector("text=Código de invitación");
  const codeB = (await b1.page.locator("p.font-mono.text-gold").innerText()).trim();

  // Join.
  await a2.page.fill('input[placeholder="Código de invitación"]', codeA);
  await a2.page.click('button:has-text("Unirse")');
  await a2.page.waitForSelector("text=Alfa Uno");

  await b2.page.fill('input[placeholder="Código de invitación"]', codeB);
  await b2.page.click('button:has-text("Unirse")');
  await b2.page.waitForSelector("text=Beta Uno");

  // A1 refreshes to see presence + the challenge button.
  await a1.page.reload();
  await a1.page.waitForSelector("text=Aventureros en esta isla", { timeout: 10000 });
  await a1.page.waitForSelector("text=Desafiar a", { timeout: 10000 });
  await a1.page.screenshot({ path: path.join(shotsDir, "b1-presence.png"), fullPage: true });

  await a1.page.click(`button:has-text("Desafiar a Crew Beta")`);
  await a1.page.waitForSelector('text=Proponer batalla');
  await a1.page.screenshot({ path: path.join(shotsDir, "b2-matchup-builder.png"), fullPage: true });

  const selects = a1.page.locator("select");
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    await selects.nth(i).selectOption({ index: 1 });
  }
  await a1.page.screenshot({ path: path.join(shotsDir, "b3-matchups-chosen.png"), fullPage: true });
  await a1.page.click('button:has-text("Proponer batalla")');
  await a1.page.waitForTimeout(700);
  await a1.page.screenshot({ path: path.join(shotsDir, "b4-proposed.png"), fullPage: true });

  // B1 accepts.
  await b1.page.reload();
  await b1.page.waitForSelector("text=Batallas de tripulación", { timeout: 10000 });
  await b1.page.waitForSelector('button:has-text("Aceptar")', { timeout: 10000 });
  await b1.page.screenshot({ path: path.join(shotsDir, "b5-pending-for-defender.png"), fullPage: true });
  await b1.page.click('button:has-text("Aceptar")');
  await b1.page.waitForTimeout(1000);
  await b1.page.screenshot({ path: path.join(shotsDir, "b6-resolved-defender.png"), fullPage: true });

  // A1 reloads to see the resolved outcome.
  await a1.page.reload();
  await a1.page.waitForTimeout(500);
  await a1.page.screenshot({ path: path.join(shotsDir, "b7-resolved-challenger.png"), fullPage: true });

  const bodyText = await a1.page.locator("body").innerText();
  const hasOutcome = bodyText.includes("Victoria") || bodyText.includes("Derrota");
  console.log("Battle shows a resolved outcome for challenger:", hasOutcome);
  console.log(hasOutcome ? "PASS" : "FAIL — check screenshots");
} catch (e) {
  console.error("SCRIPT ERROR:", e);
} finally {
  await browser.close();
}
