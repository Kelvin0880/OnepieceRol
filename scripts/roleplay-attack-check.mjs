// Live check for the bar-attack bug (2026-09-23): a player attacking someone in
// the scene must get a combat answer to THAT action, never an unrelated random
// encounter. Also checks: Enter inserts a newline (does not send), stamina bar,
// and the new CP-0 faction. Requires `npm run dev` + a real OPENROUTER_API_KEY.
// Usage: node scripts/roleplay-attack-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(label, cond) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

const BASE = "http://localhost:3000";
const username = "rpcheck" + (Date.now() % 100000);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
const actionPosts = [];
page.on("request", (r) => {
  if (r.method() === "POST" && r.url().includes("/actions")) actionPosts.push(r.postData());
});

async function register() {
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
}

async function createCharacter(name, factionLabel, archetype) {
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click(`button:has-text("${factionLabel}")`);
  await page.click(`button:has-text("${archetype}")`);
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 10000 });
}

try {
  await register();
  await createCharacter("Piña D Kelvin", "Pirata", "Espadachín");

  // --- Enter must be a newline, never a send ---
  await page.fill("textarea", "Primera línea");
  await page.press("textarea", "Enter");
  await page.type("textarea", "segunda línea");
  const value = await page.inputValue("textarea");
  check("Enter inserts a newline in the textarea", value.includes("\n"));
  check("Enter did not send the action", actionPosts.length === 0);

  // --- The attack that used to be answered by a random 'maleantes' event ---
  await page.fill("textarea", "");
  // Establish the scene first, so there is somebody to attack.
  await page.fill(
    "textarea",
    'Entro al bar con paso firme y miro a todos.\n"¿Alguien tiene algo que decirme?" digo con una sonrisa desafiante.'
  );
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await page.fill(
    "textarea",
    'Callate viejo. Al primero que se me acerque lo miro con desdén, saco mi katana en un solo movimiento e intento cortarle el pecho con un tajo horizontal.\nSi el golpe conecta, miro a todos y digo "¿alguien interesante quiere acompañarme?"'
  );
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(shotsDir, "attack-1.png"), fullPage: true });

  const body = await page.textContent("body");
  check("attack was interpreted as an attack (not explore)", body.includes("interpretado como: Atacar"));
  check("the old unrelated random encounter did not appear", !body.includes("Un grupo de maleantes de poca monta"));
  const inFight = (await page.locator("text=Sigues luchando contra").count()) > 0 || (await page.locator("text=está derrotado").count()) > 0;
  check("a real fight against the target started (enemy HP bar / victory prompt)", inFight);
  check("stamina bar is shown", body.includes("Estamina"));

  // A second move keeps the exchange going round by round.
  if ((await page.locator("text=Sigues luchando contra").count()) > 0) {
    await page.fill("textarea", "Me giro y bloqueo su contraataque con la hoja, buscando su flanco.");
    await page.click('button:has-text("Actuar")');
    await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(shotsDir, "attack-2.png"), fullPage: true });
    check("second move resolved as another combat round", (await page.textContent("body")).includes("interpretado como: Luchar") || (await page.locator("text=está derrotado").count()) > 0);
  }

  // --- CP-0 faction ---
  await page.goto(BASE);
  await page.waitForSelector("text=Tus personajes");
  await createCharacter("Agente Sombra", "CP-0", "Tirador");
  const header = await page.textContent("h1 + p");
  check("CP-0 character starts with the Aspirante title", header?.includes("Aspirante") ?? false);
  await page.screenshot({ path: path.join(shotsDir, "cp0.png"), fullPage: true });
} catch (err) {
  console.error(err);
  failures++;
  await page.screenshot({ path: path.join(shotsDir, "attack-error.png"), fullPage: true }).catch(() => {});
}

await browser.close();
console.log(failures === 0 ? "\nAll roleplay-attack checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
