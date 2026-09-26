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

  // Rounds: everybody writes, then the narrator answers all actions at once. No turn order.
  check("a round starts with nobody having acted", await a.page.locator("text=Ronda: 0 de 2 han actuado.").isVisible().catch(() => false));
  await b.page.fill("textarea", "prueba");
  check("nobody is locked out at the start of a round", !(await b.page.locator('button:has-text("Actuar")').isDisabled()));
  await b.page.fill("textarea", "");

  const narratorCount = async (page) => page.locator(".bubble-narrator").count();
  await act(a.page, "Sonrío a mis compañeros y les comento en voz alta lo tranquilo que parece el pueblo.");
  await a.page.waitForSelector("text=Esperando a Marinero B", { timeout: 90000 }).catch(() => {});
  await a.page.screenshot({ path: path.join(shotsDir, "party-02-a-acted.png"), fullPage: true });
  check("after acting, the member waits for the rest instead of getting an answer", await a.page.locator("text=Esperando a Marinero B").first().isVisible().catch(() => false));
  check("the action is visible to the whole group right away", await (async () => { await b.page.reload(); await b.page.waitForSelector("text=Escena compartida", { timeout: 45000 }); return b.page.locator("text=lo tranquilo que parece el pueblo").first().isVisible().catch(() => false); })());
  check("the second member sees the round is one action in", await b.page.locator("text=Ronda: 1 de 2 han actuado.").isVisible().catch(() => false));
  const before = await narratorCount(b.page);

  await act(b.page, "Asiento con calma y le respondo a mi capitana que estoy de acuerdo con ella.");
  await b.page.screenshot({ path: path.join(shotsDir, "party-04-b-acted.png"), fullPage: true });
  await a.page.reload();
  await a.page.waitForSelector("text=Escena compartida", { timeout: 45000 });
  await a.page.waitForSelector("text=Ronda: 0 de 2 han actuado.", { timeout: 45000 });
  check("once everyone acted the narrator answered and a new round opened", true);
  check("captain's client shows both names in the shared transcript", await a.page.locator("text=Marinero B").first().isVisible().catch(() => false));
  await a.page.screenshot({ path: path.join(shotsDir, "party-05-a-sees-both.png"), fullPage: true });
  await b.page.reload();
  await b.page.waitForSelector("text=Escena compartida", { timeout: 45000 });
  check("exactly one narrator answer covered the round", (await narratorCount(b.page)) - before === 1);

  // Someone can close a round with the actions already in.
  await act(a.page, "Sigo mirando alrededor mientras esperamos noticias.");
  check("the close-round button appears once someone acted", await a.page.locator('[data-testid="party-close-round"]').isVisible().catch(() => false));
  await a.page.click('[data-testid="party-close-round"]');
  await a.page.waitForSelector("text=Ronda: 0 de 2 han actuado.", { timeout: 60000 });
  check("closing the round makes the narrator answer with whoever acted", true);
  await b.page.reload();
  await b.page.waitForSelector("text=Escena compartida", { timeout: 45000 });

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
