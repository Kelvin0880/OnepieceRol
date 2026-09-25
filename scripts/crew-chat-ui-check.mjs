// Real-browser check (390px) of the crew chat tab inside the Den Den Mushi. Needs `npm run dev`.
// Usage: node scripts/crew-chat-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { foundCrew, joinCrewByCode } from "./lib/crew-ui.mjs";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label} ${extra}`);
  if (!cond) failures++;
};
const BASE = "http://localhost:3000";
const stamp = Date.now() % 100000;
const browser = await chromium.launch();

async function newPlayer(tag, charName) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `cc${tag}${stamp}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 15000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', charName);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 20000 });
  return page;
}
const open = async (p) => {
  await p.reload();
  await p.waitForSelector('[data-testid="denden-open"]');
  await p.click('[data-testid="denden-open"]');
  await p.waitForSelector('[data-testid="denden-panel"]');
};

try {
  const a = await newPlayer("a", `Capi${stamp % 1000}`);
  const b = await newPlayer("b", `Mozo${stamp % 1000}`);
  const c = await newPlayer("c", `Fuera${stamp % 1000}`);

  await open(c);
  check("a player with no crew sees no crew tab", (await c.locator('[data-testid="denden-tab-crew"]').count()) === 0);

  const code = await foundCrew(a, `Tripu${stamp}`, "calavera");
  await joinCrewByCode(b, code);

  await open(a);
  await a.waitForSelector('[data-testid="denden-tab-crew"]');
  await a.click('[data-testid="denden-tab-crew"]');
  await a.waitForFunction(() => document.querySelector('[data-testid="denden-channel"]')?.textContent?.includes("Tripu"), null, { timeout: 15000 });
  await a.fill('[data-testid="denden-input"]', "Zarpamos al amanecer, nakama.");
  await a.click('[data-testid="denden-send"]');
  await a.waitForSelector('[data-testid="denden-message"]');
  await a.screenshot({ path: path.join(shots, "crew-chat-a.png"), fullPage: true });

  await open(b);
  await b.click('[data-testid="denden-tab-crew"]');
  await b.waitForFunction(() => document.querySelector('[data-testid="denden-messages"]')?.textContent?.includes("Zarpamos al amanecer"), null, { timeout: 15000 });
  check("a crewmate reads the crew message", true);
  await b.screenshot({ path: path.join(shots, "crew-chat-b.png"), fullPage: true });
  await b.click('[data-testid="denden-tab-faction"]');
  await b.waitForTimeout(800);
  check("it is not in the faction channel", !(await b.textContent('[data-testid="denden-messages"]')).includes("Zarpamos al amanecer"));

  await open(c);
  check("the outsider does not see it in the faction channel", !(await c.textContent('[data-testid="denden-messages"]')).includes("Zarpamos al amanecer"));
  const w = await a.evaluate(() => document.documentElement.scrollWidth);
  check("the panel fits 390px", w <= 391, `(${w})`);
  check("no page errors", [a, b, c].every((p) => p.errors.length === 0), [a, b, c].flatMap((p) => p.errors).join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
