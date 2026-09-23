// Live check of 1-vs-1 player duels: two real accounts on the same island,
// challenge -> accept -> both submit a move -> the engine resolves the round
// and the narrator answers both. Requires `npm run dev` + OPENROUTER_API_KEY.
// Usage: node scripts/duel-smoke.mjs
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
const stamp = Date.now() % 100000;
const browser = await chromium.launch();
const NAME_A = "Retador" + (stamp % 1000);
const NAME_B = "Rival" + (stamp % 1000);

async function newPlayer(tag, charName) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `duel${tag}${stamp}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', charName);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 10000 });
  return page;
}

async function move(page, text) {
  await page.fill("textarea", text);
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  const a = await newPlayer("a", NAME_A);
  const b = await newPlayer("b", NAME_B);
  await a.reload();
  await a.waitForSelector("text=Aventureros en esta isla");
  a.on("response", async (r) => { if (r.url().includes("/duel")) console.log("DUEL RESP", r.status(), await r.text()); });
  await a.locator("div.text-sm", { hasText: NAME_B }).locator('button:has-text("Retar a duelo")').first().click();
  await a.waitForSelector(`text=Duelo contra ${NAME_B}`);
  check("challenger sees a pending duel panel", (await a.locator("text=Reto pendiente").count()) > 0);

  await b.reload();
  await b.waitForSelector(`text=Duelo contra ${NAME_A}`);
  check("opponent sees the challenge with an accept button", (await b.locator('button:has-text("Aceptar duelo")').count()) > 0);
  await b.click('button:has-text("Aceptar duelo")');
  await b.waitForSelector("text=Ronda 1");
  await a.reload();
  await a.waitForSelector("text=Ronda 1");
  check("both sides are in round 1 after accepting", true);

  await move(a, 'Me lanzo con un tajo horizontal a su costado.\n"¡Prepárate!"');
  check("first mover is told to wait for the rival", (await a.locator("text=Movimiento enviado").count()) > 0);
  await move(b, "Retrocedo un paso y bloqueo con mi espada, buscando contraatacar a la cabeza.");
  await a.reload();
  await b.reload();
  await a.waitForSelector(`text=Duelo contra ${NAME_B}`);
  const bodyA = await a.textContent("body");
  const bodyB = await b.textContent("body");
  check("a narrator answer for both moves appears for the challenger", bodyA.includes("Narrador"));
  check("the same narration reaches the opponent", bodyB.includes("Narrador"));
  const hpBarsChanged = bodyA.match(/(\d+)\/(\d+)/g) ?? [];
  console.log("HP readings:", hpBarsChanged.slice(0, 6).join(" | "));
  check("round advanced (or duel finished)", bodyA.includes("Ronda 2") || bodyA.includes("Terminado"));
  await a.screenshot({ path: path.join(shotsDir, "duel-a.png"), fullPage: true });
  await b.screenshot({ path: path.join(shotsDir, "duel-b.png"), fullPage: true });
} catch (err) {
  console.error(err);
  failures++;
}

await browser.close();
console.log(failures === 0 ? "\nAll duel checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
