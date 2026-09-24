// Real-browser verification for multiplayer party presence: two crewmates
// on the same island share one live scene with turn order, a separation
// confirm flow, and rejoin. Requires `npm run dev` running with a real
// OPENROUTER_API_KEY in .env. Usage: node scripts/party-multiplayer-smoke.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { foundCrew, joinCrewByCode } from "./lib/crew-ui.mjs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;
function check(label, cond) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

async function registerAndCreate(name, characterName) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`[${name}] pageerror:`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error(`[${name}] console error:`, m.text());
  });

  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', name);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 45000 });

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', characterName);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 45000 });

  return { page };
}

async function act(page, text) {
  await page.fill("textarea", text);
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000); // stay well under OpenRouter's free-tier rate limit
}

try {
  const a = await registerAndCreate("partyA_" + Date.now(), "Capitana A");
  const b = await registerAndCreate("partyB_" + Date.now(), "Marinero B");

  const crewName = "Vendaval " + (Date.now() % 1000000); // stays under the 32-char crew name limit
  const inviteCode = await foundCrew(a.page, crewName, "Una calavera envuelta en tormenta.");
  await joinCrewByCode(b.page, inviteCode);

  // Both characters start on the same island by default (same faction) —
  // reload both so each side's own GET materializes the shared party.
  await a.page.reload();
  await b.page.reload();
  await a.page.waitForSelector("text=Escena compartida", { timeout: 45000 });
  await b.page.waitForSelector("text=Escena compartida", { timeout: 45000 });
  await a.page.screenshot({ path: path.join(shotsDir, "party-01-a-shared-scene.png"), fullPage: true });
  await b.page.screenshot({ path: path.join(shotsDir, "party-01-b-shared-scene.png"), fullPage: true });
  check("both clients show the shared party scene panel", true);

  // Captain (A) founded the crew, so turn order puts her first.
  check("it's the captain's turn first", await a.page.locator("text=Es tu turno.").isVisible().catch(() => false));
  check("the second member's turn is blocked, showing whose turn it is", await b.page.locator("text=Le toca a Capitana A.").isVisible().catch(() => false));
  const bActuarDisabled = await b.page.locator('button:has-text("Actuar")').isDisabled();
  check("out-of-turn member's Actuar button is disabled", bActuarDisabled);

  await act(a.page, "Miro a mi tripulación y les propongo explorar juntos el pueblo.");
  await a.page.screenshot({ path: path.join(shotsDir, "party-02-a-turn-done.png"), fullPage: true });

  await b.page.reload();
  await b.page.waitForSelector("text=Escena compartida", { timeout: 45000 });
  check("turn passed to the second member after the captain's beat", await b.page.locator("text=Es tu turno.").isVisible().catch(() => false));
  await b.page.screenshot({ path: path.join(shotsDir, "party-03-b-turn.png"), fullPage: true });

  await act(b.page, "Sigo a mi capitana y observo el pueblo con curiosidad.");
  await b.page.screenshot({ path: path.join(shotsDir, "party-04-b-turn-done.png"), fullPage: true });

  await a.page.reload();
  await a.page.waitForSelector("text=Escena compartida", { timeout: 45000 });
  check("captain's client shows both names in the shared transcript", await a.page.locator("text=Marinero B").first().isVisible().catch(() => false));
  await a.page.screenshot({ path: path.join(shotsDir, "party-05-a-sees-both.png"), fullPage: true });

  // Turn wrapped back to the captain after B's beat — pass it to B again
  // before B can act.
  await act(a.page, "Sigo mirando alrededor mientras esperamos noticias.");
  await b.page.reload();
  await b.page.waitForSelector("text=Escena compartida", { timeout: 45000 });
  await b.page.waitForSelector("text=Es tu turno.", { timeout: 45000 });

  // Separation: free text should require an explicit confirm, not act immediately.
  await b.page.fill("textarea", "Me separo del grupo y me voy por mi cuenta a mirar el mercado.");
  await b.page.click('button:has-text("Actuar")');
  await b.page.waitForSelector("text=¿Quieres separarte de tus nakamas?", { timeout: 45000 });
  await b.page.screenshot({ path: path.join(shotsDir, "party-06-b-leave-confirm.png"), fullPage: true });
  check("separation shows an explicit confirm prompt instead of acting immediately", true);

  await b.page.click('button:has-text("Sí, separarme")');
  await b.page.waitForTimeout(1500);
  await b.page.reload();
  const bStillShared = await b.page.locator("text=Escena compartida").isVisible().catch(() => false);
  check("confirmed separation drops the member back to a private scene", !bStillShared);
  await b.page.screenshot({ path: path.join(shotsDir, "party-07-b-separated.png"), fullPage: true });

  await a.page.reload();
  const aStillShared = await a.page.locator("text=Escena compartida").isVisible().catch(() => false);
  check("the remaining lone member's party dissolves too (fewer than 2 together)", !aStillShared);

  // Rejoin: same island, same crew, both alive — button should reappear.
  const rejoinVisible = await b.page.locator('button:has-text("Unirme al grupo")').isVisible().catch(() => false);
  check('"Unirme al grupo" button is offered after separating while still on the same island', rejoinVisible);
  if (rejoinVisible) {
    await b.page.click('button:has-text("Unirme al grupo")');
    await b.page.waitForResponse((r) => r.url().includes("/actions") && r.request().method() === "POST", { timeout: 45000 }).catch(() => {});
    await b.page.waitForTimeout(1000);

    let bRejoined = false;
    let aRejoined = false;
    for (let attempt = 0; attempt < 3 && !(bRejoined && aRejoined); attempt++) {
      await b.page.reload();
      await a.page.reload();
      await b.page.waitForTimeout(500);
      bRejoined = await b.page.locator("text=Escena compartida").isVisible().catch(() => false);
      aRejoined = await a.page.locator("text=Escena compartida").isVisible().catch(() => false);
    }
    check("both clients see the shared scene again after rejoining", bRejoined && aRejoined);
    await b.page.screenshot({ path: path.join(shotsDir, "party-08-b-rejoined.png"), fullPage: true });
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  failures++;
} finally {
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
