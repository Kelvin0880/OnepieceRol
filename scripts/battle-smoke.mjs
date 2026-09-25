// Verifies the N-vs-N crew battle loop end to end with 4 real accounts:
// two crews of 2 on the same starting island, a challenge with individually
// chosen matchups, the defending captain accepting, and a resolved result
// with a winner. Requires the dev server at localhost:3000.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { foundCrew, joinCrewByCode } from "./lib/crew-ui.mjs";

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
  const codeA = await foundCrew(a1.page, "Crew Alfa " + Date.now(), "Bandera de prueba A");
  const codeB = await foundCrew(b1.page, "Crew Beta " + Date.now(), "Bandera de prueba B");

  // Join.
  await joinCrewByCode(a2.page, codeA);
  await joinCrewByCode(b2.page, codeB);

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

  // Accepting starts one real duel per matchup: the battle is "en curso" until every duel ends.
  await b1.page.reload();
  await b1.page.waitForSelector('[data-testid="duel-yield"]', { timeout: 15000 });
  const inProgress = (await b1.page.locator("body").innerText()).includes("En curso");
  console.log("Battle shows as in progress after accepting:", inProgress);

  // Both members of crew A give up their duel ("Perdí"): the other side wins both, and the battle settles.
  for (const p of [a1.page, a2.page]) {
    await p.reload();
    await p.waitForSelector('[data-testid="duel-yield"]', { timeout: 15000 });
    await p.click('[data-testid="duel-yield"]');
    await p.click('[data-testid="duel-yield-confirm"]');
    await p.waitForTimeout(1200);
  }
  await a1.page.reload();
  await a1.page.waitForTimeout(800);
  await a1.page.screenshot({ path: path.join(shotsDir, "b7-resolved-challenger.png"), fullPage: true });
  await b1.page.reload();
  await b1.page.waitForTimeout(800);
  await b1.page.screenshot({ path: path.join(shotsDir, "b6-resolved-defender.png"), fullPage: true });

  const bodyA = await a1.page.locator("body").innerText();
  const bodyB = await b1.page.locator("body").innerText();
  const okA = bodyA.includes("Derrota");
  const okB = bodyB.includes("Victoria");
  console.log("Challenger sees a defeat:", okA, "| defender sees a victory:", okB);
  console.log(inProgress && okA && okB ? "PASS" : "FAIL — check screenshots");
} catch (e) {
  console.error("SCRIPT ERROR:", e);
} finally {
  await browser.close();
}
