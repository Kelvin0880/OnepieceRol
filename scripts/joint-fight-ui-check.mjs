// Real-browser check of joint fights (2026-09-24): two crewmates share a scene, one attacks
// someone, and BOTH get the shared "Pelea en grupo" panel, act each round and see the
// same transcript. Needs `npm run dev` and a real OPENROUTER_API_KEY.
// Usage: node scripts/joint-fight-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { foundCrew, joinCrewByCode } from "./lib/crew-ui.mjs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond) => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
};

async function registerAndCreate(name, characterName) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`[${name}] pageerror:`, e.message));
  page.on("console", (m) => m.type() === "error" && !/40[0-9]|Failed to load resource/.test(m.text()) && console.error(`[${name}] console error:`, m.text()));
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
  await page.waitForSelector("text=Escena", { timeout: 15000 });
  return { page };
}

async function send(page, text) {
  await page.fill("textarea", text);
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  const stamp = Date.now();
  const a = await registerAndCreate("jfA_" + stamp, "Capitan Uno");
  const b = await registerAndCreate("jfB_" + stamp, "Marinero Dos");
  const crewName = "Tormenta " + (stamp % 1000000);
  const code = await foundCrew(a.page, crewName, "Rayo sobre calavera.");
  await joinCrewByCode(b.page, code);
  await a.page.reload();
  await b.page.reload();
  await a.page.waitForSelector("text=Escena compartida", { timeout: 15000 });
  await b.page.waitForSelector("text=Escena compartida", { timeout: 15000 });

  // The captain starts the brawl; the crewmate is pulled into the same fight.
  await send(a.page, "Me acerco al tabernero fanfarrón y le lanzo un puñetazo a la mandíbula.");
  await a.page.waitForSelector("text=Pelea en grupo contra", { timeout: 20000 });
  check("the attacker sees the joint fight panel", true);
  await b.page.reload();
  await b.page.waitForSelector("text=Pelea en grupo contra", { timeout: 20000 });
  check("the crewmate is pulled into the same fight", true);
  await a.page.screenshot({ path: path.join(shotsDir, "joint-a-start.png"), fullPage: true });
  check("both participants are listed on A's panel", (await a.page.locator('[data-testid="joint-participant"]').count()) >= 2);

  // The crewmate answers; with both moves in, the engine resolves the round for everyone.
  await send(b.page, "Cubro el flanco de mi capitán y golpeo al tabernero con la empuñadura.");
  await a.page.waitForTimeout(500);
  await a.page.reload();
  await a.page.waitForSelector("text=Pelea en grupo contra");
  const textA = await a.page.textContent("body");
  check("round 2 is open after both moved (Ronda 2 or fight concluded)", /Ronda 2/.test(textA) || /Victoria|Derrota/.test(textA));
  check("the shared transcript shows both names", textA.includes("Capitan Uno") && textA.includes("Marinero Dos"));
  await a.page.screenshot({ path: path.join(shotsDir, "joint-a-round1.png"), fullPage: true });
  await b.page.reload();
  await b.page.waitForSelector("text=Pelea en grupo contra");
  await b.page.screenshot({ path: path.join(shotsDir, "joint-b-round1.png"), fullPage: true });
} catch (err) {
  console.error(err);
  failures++;
}
await browser.close();
console.log(failures === 0 ? "ALL PASS" : failures + " FAILED");
process.exit(failures === 0 ? 0 : 1);
