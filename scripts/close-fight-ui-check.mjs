// "Finalizar pelea" in a real browser: the button exists only during a fight, and the AI judge closes it.
// Requires `npm run dev` running. Usage: node scripts/close-fight-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(label, cond) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
  console.log("screenshot:", name);
}

async function act(page, text) {
  await page.fill("textarea", text);
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
}


const username = "closefight" + (Date.now() % 100000);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
try {
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "Finalizador");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 10000 });
  const characterId = page.url().split("/play/")[1];

  check("no 'finalizar pelea' button outside a fight", (await page.locator('[data-testid="close-fight-open"]').count()) === 0);
  execSync(`npx tsx scripts/force-threat-encounter.ts ${characterId}`, { stdio: "inherit" });
  await page.reload();
  await page.waitForSelector("text=Te enfrentas a", { timeout: 10000 });
  check("still no button before the first exchange (fight-or-flee)", (await page.locator('[data-testid="close-fight-open"]').count()) === 0);
  await act(page, "Ataco de frente con mi espada, buscando su costado.");
  await page.waitForSelector("text=Sigues luchando contra", { timeout: 20000 }).catch(() => {});
  const inFight = (await page.locator("text=Sigues luchando contra").count()) > 0;
  if (!inFight) {
    console.log("the fight already ended in one exchange; nothing to close");
  } else {
    check("the button appears once the fight is under way", (await page.locator('[data-testid="close-fight-open"]').count()) === 1);
    await page.click('[data-testid="close-fight-open"]');
    await shot(page, "closefight-01-confirm.png");
    await page.fill('[data-testid="close-fight-panel"] textarea', "Ya lo derroté, la pelea terminó.");
    await page.click('[data-testid="close-fight-confirm"]');
    await page.waitForSelector("text=Juzgando...", { state: "hidden", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, "closefight-02-closed.png");
    check("the fight panel is gone or moved to the mercy choice", (await page.locator("text=Sigues luchando contra").count()) === 0);
    check("the scene tells the player how the fight ended", (await page.locator("text=Pelea finalizada").count()) > 0);
  }
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  failures++;
} finally {
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
