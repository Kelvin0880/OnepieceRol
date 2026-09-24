// Real-browser check (2026-09-24): narrator answers the CURRENT message, replies stay short for short input,
// "Limpiar escena" works, panels fit a phone screen. Needs `npm run dev` + an OpenRouter key.
// Usage: node scripts/polish-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label} ${extra}`);
  if (!cond) failures++;
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const overflow = async (label) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`${label} fits a 390px screen`, o.sw <= 391 && o.iw <= 391, `(scrollWidth ${o.sw} > ${o.iw})`);
};

async function send(text) {
  await page.fill("textarea", text);
  await page.click('button:has-text("Actuar")');
  await page.waitForFunction((t) => !document.body.innerText.includes("narrando") && !document.body.innerText.includes("Pensando"), text, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(800);
}

try {
  await page.goto("http://localhost:3000");
  await overflow("login page");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `polish_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await overflow("character creation");
  await page.fill('input[placeholder*="Roronoa"]', `Polish${Date.now() % 10000}`);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="missions-panel"]', { timeout: 30000 });
  await overflow("play screen");
  await page.screenshot({ path: path.join(shots, "polish-01-play-mobile.png"), fullPage: true });

  // 1) a short question -> a short reply that answers it
  await send("Le pregunto al tabernero cómo se llama este lugar.");
  const bubbles = () => page.locator('[data-testid="scene-log"] > div, .scene-bubble');
  let full = await page.innerText("body");
  const idx = full.indexOf("Le pregunto al tabernero");
  const after = full.slice(idx).split("\n").filter((l) => l.trim().length > 40);
  console.log("first reply excerpt:", (after[1] ?? after[0] ?? "").slice(0, 400));
  const reply = after.find((l) => !l.includes("Le pregunto al tabernero")) ?? "";
  const words = reply.split(/\s+/).filter(Boolean).length;
  check("a one-line question gets a short reply (under 160 words)", reply.length > 0 && words < 160, `(${words} words)`);
  check("the reply does not just echo the question", !reply.includes("Le pregunto al tabernero cómo"));
  await page.screenshot({ path: path.join(shots, "polish-02-short-reply.png"), fullPage: true });

  // 2) change of topic: the narrator must answer the NEW message, not the previous one
  await send("Ahora me despido y salgo a caminar por el muelle a mirar los barcos.");
  full = await page.innerText("body");
  const tail = full.slice(full.lastIndexOf("Ahora me despido"));
  check("the answer to a new topic talks about the pier/ships (the current message)", /muelle|barco|puerto|mar|olas|gaviota/i.test(tail), tail.slice(0, 300));

  // 3) out-of-role panel fits, and clearing the scene works
  await page.click('[data-testid="ooc-open"]');
  await page.waitForSelector('[data-testid="ooc-panel"]');
  await overflow("out-of-role panel");
  await page.click('button:has-text("Herramientas")');
  await overflow("out-of-role tools");
  await page.screenshot({ path: path.join(shots, "polish-03-ooc-mobile.png"), fullPage: true });
  await page.click('[data-testid="ooc-clear-scene"]');
  await page.waitForSelector('[data-testid="ooc-notice"]:has-text("Escena limpia")');
  check("clearing the scene reports success", true);
  await page.click('button:has-text("Volver al rol")');
  await page.waitForTimeout(1500);
  full = await page.innerText("body");
  check("the old messages left the screen", !full.includes("Le pregunto al tabernero") && !full.includes("Ahora me despido"));
  await send("Miro a mi alrededor buscando un lugar donde sentarme.");
  full = await page.innerText("body");
  check("after clearing, the narrator still answers", full.includes("Miro a mi alrededor") && !full.includes("no respondió"));
  await page.screenshot({ path: path.join(shots, "polish-04-after-clear.png"), fullPage: true });

  // 4) other panels on a phone
  await page.click('[data-testid="crew-open-header"]');
  await page.waitForTimeout(800);
  await overflow("crew panel");
  await page.screenshot({ path: path.join(shots, "polish-05-crew-mobile.png"), fullPage: true });
  await page.goto("http://localhost:3000/news");
  await page.waitForTimeout(1500);
  await overflow("news page");
  await page.screenshot({ path: path.join(shots, "polish-06-news-mobile.png"), fullPage: true });
  await page.goto("http://localhost:3000/codex");
  await page.waitForTimeout(1500);
  await overflow("codex page");
  await page.screenshot({ path: path.join(shots, "polish-07-codex-mobile.png"), fullPage: true });
  await page.goto("http://localhost:3000");
  await page.waitForTimeout(1000);
  await overflow("character list");

  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.log("ERROR:", e.message);
  failures++;
  await page.screenshot({ path: path.join(shots, "polish-error.png"), fullPage: true }).catch(() => {});
}
await browser.close();
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
