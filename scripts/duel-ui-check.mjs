// Real-browser check (390px phones) of the player-duel buttons and the Den Den Mushi chat. Needs `npm run dev`.
// The referee is the real AI here; the checks only assert the flow, never the prose.
// Usage: node scripts/duel-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

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
  await page.fill('input[placeholder="Nombre de usuario"]', `dui${tag}${stamp}`);
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
  page.charId = page.url().split("/play/")[1];
  return page;
}
const fits = async (page, label) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${label} fits 390px`, w <= 391, `(${w})`);
};
const duelApi = (page, body) => page.evaluate(async ({ id, body }) => (await fetch(`/api/characters/${id}/duel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, { id: page.charId, body });

try {
  const NA = `Alfa${stamp % 1000}`;
  const NB = `Beta${stamp % 1000}`;
  const a = await newPlayer("a", NA);
  const b = await newPlayer("b", NB);
  await a.reload();
  await b.reload();
  await a.waitForSelector("text=Aventureros en esta isla");

  // ---- friendly duel: "Perdí" ends it, nothing else happens
  await a.locator("div.text-sm", { hasText: NB }).locator('button:has-text("Retar a duelo")').first().click();
  await a.waitForSelector(`text=Duelo contra ${NB}`);
  await b.reload();
  await b.waitForSelector('button:has-text("Aceptar duelo")');
  await b.click('button:has-text("Aceptar duelo")');
  await b.waitForSelector("text=Ronda 1");
  await a.reload();
  await a.waitForSelector('[data-testid="duel-yield"]');
  check("a friendly duel shows Perdí but no flee button", (await a.locator('[data-testid="duel-flee"]').count()) === 0);
  await fits(a, "the duel panel");
  await a.screenshot({ path: path.join(shots, "duel-01-buttons.png"), fullPage: true });
  await a.click('[data-testid="duel-yield"]');
  await a.click('[data-testid="duel-yield-confirm"]');
  await a.waitForSelector("text=Has perdido el duelo");
  await b.reload();
  await b.waitForSelector("text=Has ganado el duelo");
  check("the loser is told they lost and the winner that they won", true);
  const sheetA = await a.textContent("body");
  check("a friendly loss changes nothing (still alive, no verdict panel)", (await a.locator('[data-testid="duel-verdict"]').count()) === 0 && !sheetA.includes("Muerto"));

  // ---- fight to the death: flee plea, refusal, give up, capture
  check("a lethal challenge is accepted by the API", (await duelApi(a, { op: "challenge", opponentId: b.charId, lethal: true })) === 200);
  await b.reload();
  await b.waitForSelector('button:has-text("Aceptar duelo a muerte")');
  await b.click('button:has-text("Aceptar duelo a muerte")');
  await b.waitForSelector("text=Ronda 1");
  await a.reload();
  await a.waitForSelector('[data-testid="duel-flee"]');
  await a.click('[data-testid="duel-flee"]');
  await a.fill('[data-testid="duel-flee-text"]', "Lanzo una bomba de humo y salto al muelle para perderme entre los barcos.");
  await a.click('[data-testid="duel-flee-send"]');
  await b.reload();
  await b.waitForSelector('[data-testid="duel-flee-plea"]');
  check("the rival sees the escape as it was written, with allow / refuse buttons", (await b.textContent('[data-testid="duel-flee-plea"]')).includes("bomba de humo") && (await b.locator('[data-testid="duel-flee-deny"]').count()) === 1);
  await fits(b, "the flee decision");
  await b.screenshot({ path: path.join(shots, "duel-02-flee-plea.png"), fullPage: true });
  await b.click('[data-testid="duel-flee-deny"]');
  await b.waitForSelector('[data-testid="duel-controls"]');
  check("refusing the escape puts the duel back in play", true);

  await a.reload();
  await a.waitForSelector('[data-testid="duel-yield"]');
  await a.click('[data-testid="duel-yield"]');
  await a.click('[data-testid="duel-yield-confirm"]');
  await a.waitForSelector("text=Estás a merced");
  await b.reload();
  await b.waitForSelector('[data-testid="duel-verdict"]');
  check("the winner gets kill / capture / spare", (await b.locator('[data-testid="duel-kill"]').count()) === 1 && (await b.locator('[data-testid="duel-capture"]').count()) === 1 && (await b.locator('[data-testid="duel-spare"]').count()) === 1);
  check("a pirate winner is offered to hand the captive to the Marines", (await b.textContent('[data-testid="duel-capture"]')).includes("Marina"));
  await fits(b, "the verdict");
  await b.screenshot({ path: path.join(shots, "duel-03-verdict.png"), fullPage: true });
  await b.click('[data-testid="duel-capture"]');
  await b.waitForSelector("text=Has ganado el duelo");
  await a.reload();
  await a.waitForSelector("text=Has perdido el duelo");
  const st = await a.evaluate(async (id) => (await (await fetch(`/api/characters/${id}`)).json()).character?.status, a.charId);
  check("the captive ends up imprisoned", st === "IMPRISONED", `(status ${st})`);
  await a.screenshot({ path: path.join(shots, "duel-04-captured.png"), fullPage: true });

  // ---- Den Den Mushi: same faction hears, and the panel fits a phone
  const c = await newPlayer("c", `Gama${stamp % 1000}`);
  await b.reload();
  await b.waitForSelector('[data-testid="denden-open"]');
  await b.click('[data-testid="denden-open"]');
  await b.waitForSelector('[data-testid="denden-panel"]');
  await b.waitForFunction(() => document.querySelector('[data-testid="denden-channel"]')?.textContent?.includes("Piratas"), null, { timeout: 15000 });
  check("the channel is the faction's", true);
  await b.fill('[data-testid="denden-input"]', "¡Reunión de piratas en Foosha al atardecer!");
  await b.click('[data-testid="denden-send"]');
  await b.waitForSelector('[data-testid="denden-message"]');
  await fits(b, "the Den Den Mushi panel");
  await b.screenshot({ path: path.join(shots, "duel-05-denden.png"), fullPage: true });
  await c.reload();
  await c.waitForSelector('[data-testid="denden-open"]');
  await c.click('[data-testid="denden-open"]');
  await c.waitForSelector('[data-testid="denden-message"]');
  check("another pirate hears it", (await c.textContent('[data-testid="denden-messages"]')).includes("Reunión de piratas"));
  await c.fill('[data-testid="denden-input"]', "Allí estaré.");
  await c.click('[data-testid="denden-send"]');
  await b.waitForFunction(() => document.querySelector('[data-testid="denden-messages"]')?.textContent?.includes("Allí estaré"), null, { timeout: 15000 });
  check("and the answer comes back to the first pirate", true);

  check("no page errors", [a, b, c].every((p) => p.errors.length === 0), [a, b, c].flatMap((p) => p.errors).join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
