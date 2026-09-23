// Real-browser check of the phase-2 world panels (2026-09-24): territory (assault, vote, owner
// tools), Buster Call banner, jail escape plan, stealth hint. Needs `npm run dev`.
// Usage: node scripts/world-panels-ui-check.mjs
import { chromium } from "playwright";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond) => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
};
const fixture = (mode, id) => {
  const r = spawnSync("npx", ["tsx", "scripts/ui-fixture.ts", mode, id], { shell: true, encoding: "utf8" });
  if (!/fixture ok/.test(r.stdout)) throw new Error("fixture failed: " + r.stdout + r.stderr);
};

async function newPlayer(tag) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `${tag}_${Date.now()}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', `Pj ${tag}`);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 15000 });
  const id = page.url().split("/play/")[1].split(/[?#]/)[0];
  return { page, id, errors };
}

try {
  // Territory: hold, then vote, then owner tools.
  const t = await newPlayer("terr");
  fixture("territory", t.id);
  await t.page.reload();
  await t.page.waitForSelector('[data-testid="territory-panel"]', { timeout: 15000 });
  let txt = await t.page.textContent('[data-testid="territory-panel"]');
  check("territory panel shows the canon holder", txt.includes("Mr. 3 (Galdino)") && txt.includes("Dominio de Whisky Peak"));
  check("assault + muster buttons are offered", txt.includes("Asaltar") && txt.includes("Sumarme a la hueste"));
  await t.page.click('button:has-text("Sumarme a la hueste")');
  await t.page.waitForSelector("text=Retirarme de la hueste", { timeout: 10000 });
  check("mustering flips the button and lists me", (await t.page.textContent('[data-testid="territory-panel"]')).includes("Hueste reunida"));
  await t.page.screenshot({ path: path.join(shotsDir, "world-territory-held.png"), fullPage: true });

  fixture("claim-vote", t.id);
  await t.page.reload();
  await t.page.waitForSelector("text=Votación abierta", { timeout: 15000 });
  check("the claim vote lets a contributor vote", (await t.page.locator('button:has-text("Votar por")').count()) >= 1);
  await t.page.screenshot({ path: path.join(shotsDir, "world-territory-vote.png"), fullPage: true });

  fixture("owner", t.id);
  await t.page.reload();
  await t.page.waitForSelector('button:has-text("Cobrar tributos")', { timeout: 15000 });
  txt = await t.page.textContent('[data-testid="territory-panel"]');
  check("owner sees garrison, tribute and fortify tools", txt.includes("Guarnición") && txt.includes("Reforzar guarnición"));
  await t.page.click('button:has-text("Cobrar tributos")');
  await t.page.waitForTimeout(1500);
  const body = await t.page.textContent("body");
  check("collecting tribute pays out", body.includes("Cobras"));
  await t.page.screenshot({ path: path.join(shotsDir, "world-territory-owner.png"), fullPage: true });
  check("owner title appears in the header", body.includes("Señor de Whisky Peak"));
  check("no page errors on the territory flow", t.errors.length === 0);

  // Buster Call banner.
  const b = await newPlayer("bust");
  fixture("buster", b.id);
  await b.page.reload();
  await b.page.waitForSelector('[data-testid="buster-call"]', { timeout: 15000 });
  txt = await b.page.textContent('[data-testid="buster-call"]');
  check("Buster Call banner shows wave, time and the defend action", txt.includes("Oleada 1/3") && txt.includes("Defender contra la oleada"));
  await b.page.screenshot({ path: path.join(shotsDir, "world-buster-call.png"), fullPage: true });
  await b.page.click('button:has-text("Defender contra la oleada")');
  await b.page.waitForSelector("text=Pelea en grupo contra", { timeout: 15000 });
  check("defending opens a joint fight against the wave", true);

  // Jail escape.
  const j = await newPlayer("jail");
  fixture("jail", j.id);
  await j.page.reload();
  await j.page.waitForSelector("text=Plan de fuga", { timeout: 15000 });
  check("jail view offers an escape plan with progress", (await j.page.textContent("body")).includes("Progreso: 0/4"));
  await j.page.fill("textarea", "Espero al cambio de guardia y aflojo el barrote que llevo días limando.");
  await j.page.click('button:has-text("Intentar la fuga")');
  await j.page.waitForTimeout(20000);
  await j.page.reload();
  await j.page.waitForSelector("text=Plan de fuga", { timeout: 15000 });
  const jt = await j.page.textContent("body");
  check("after an attempt the cooldown is enforced in the UI", /Espera \d+ min/.test(jt));
  await j.page.screenshot({ path: path.join(shotsDir, "world-jail-escape.png"), fullPage: true });

  // Stealth hint.
  const s = await newPlayer("sneak");
  fixture("stealth", s.id);
  await s.page.reload();
  await s.page.waitForSelector('[data-testid="stealth-hint"]', { timeout: 15000 });
  check("a guarded Poneglyph island hints at the stealth option", true);
  await s.page.screenshot({ path: path.join(shotsDir, "world-stealth-hint.png"), fullPage: true });
} catch (err) {
  console.error(err);
  failures++;
}
await browser.close();
console.log(failures === 0 ? "ALL PASS" : failures + " FAILED");
process.exit(failures === 0 ? 0 : 1);
