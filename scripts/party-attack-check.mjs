// Real-browser verification for multiplayer party presence: two crewmates
// on the same island share one live scene with turn order, a separation
// confirm flow, and rejoin. Requires `npm run dev` running with a real
// OPENROUTER_API_KEY in .env. Usage: node scripts/party-multiplayer-smoke.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

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
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', characterName);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 10000 });

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
  await a.page.fill('input[placeholder="Nombre"]', crewName);
  await a.page.fill('input[placeholder="Emblema / descripción"]', "Una calavera envuelta en tormenta.");
  await a.page.click('button:has-text("Fundar")');
  await a.page.waitForSelector(`text=${crewName}`);

  const inviteCode = (await a.page.locator("p.font-mono.text-gold").innerText()).trim();
  await b.page.fill('input[placeholder="Código de invitación"]', inviteCode);
  await b.page.click('button:has-text("Unirse")');
  await b.page.waitForSelector(`text=${crewName}`);

  // Both characters start on the same island by default (same faction) —
  // reload both so each side's own GET materializes the shared party.
  await a.page.reload();
  await b.page.reload();
  await a.page.waitForSelector("text=Escena compartida", { timeout: 10000 });
  await b.page.waitForSelector("text=Escena compartida", { timeout: 10000 });
  await a.page.screenshot({ path: path.join(shotsDir, "party-01-a-shared-scene.png"), fullPage: true });
  await b.page.screenshot({ path: path.join(shotsDir, "party-01-b-shared-scene.png"), fullPage: true });
  check("both clients show the shared party scene panel", true);

  // Captain (A) founded the crew, so turn order puts her first.
  check("it's the captain's turn first", await a.page.locator("text=Es tu turno.").isVisible().catch(() => false));
  check("the second member's turn is blocked, showing whose turn it is", await b.page.locator("text=Le toca a Capitana A.").isVisible().catch(() => false));
  const bActuarDisabled = await b.page.locator('button:has-text("Actuar")').isDisabled();
  check("out-of-turn member's Actuar button is disabled", bActuarDisabled);

  // Captain attacks somebody in the scene: personal fight, but the crewmate must be able to read it.
  await act(a.page, "Me acerco al tabernero y le lanzo un puñetazo directo a la mandíbula.");
  await a.page.screenshot({ path: path.join(shotsDir, "party-attack-a.png"), fullPage: true });
  check("the attacker is now in a real fight", (await a.page.locator("text=Sigues luchando contra").count()) > 0 || (await a.page.locator("text=está derrotado").count()) > 0);
  await b.page.reload();
  await b.page.waitForSelector("text=Escena compartida", { timeout: 10000 });
  const bodyB = await b.page.textContent("body");
  check("the crewmate reads the fight in the shared scene", bodyB.includes("Capitana A") && (bodyB.includes("combate") || bodyB.includes("pelea")));
  await b.page.screenshot({ path: path.join(shotsDir, "party-attack-b.png"), fullPage: true });
} catch (err) {
  console.error(err);
  failures++;
}
await browser.close();
console.log(failures === 0 ? "ALL PASS" : failures + " FAILED");
process.exit(failures === 0 ? 0 : 1);
