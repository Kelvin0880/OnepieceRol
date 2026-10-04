// Training focus selector (2026-10-04): choose what "Entrenar" trains (Armament, Observation, fruit, or "Lo más
// atrasado"), the choice is remembered, the button counts down the 30 min cooldown, and the fruit option only
// exists for fruit users. No AI call anywhere on this path. Requires `npm run dev` running.
// Usage: node scripts/train-focus-ui-check.mjs
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
const state = (id, args = "--show") => JSON.parse(execSync(`npx tsx scripts/set-training-state.ts ${id} ${args}`, { encoding: "utf8" }).trim().split("\n").pop());

const username = "trainer" + (Date.now() % 100000);
const consoleErrors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
try {
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "Entrenador");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 10000 });
  const id = page.url().split("/play/")[1];

  // Barbosa's real numbers, without a fruit first.
  state(id, "42 41 0 30"); // level 30: no level cap in the way for the focus tests
  await page.reload();
  await page.waitForSelector('[data-testid="train-focus"]', { timeout: 10000 });
  const select = page.locator('[data-testid="train-focus"]');
  const values = await select.locator("option").evaluateAll((os) => os.map((o) => o.value));
  check("no fruit option for a character without a fruit", JSON.stringify(values) === JSON.stringify(["auto", "armament", "observation"]));
  check("'auto' says what it would pick (Observación is lowest)", /Observación/.test(await select.locator('option[value="auto"]').innerText()));
  await page.screenshot({ path: path.join(shotsDir, "train-01-selector.png") });

  // An explicit choice trains exactly that, even though it isn't the lowest.
  await select.selectOption("armament");
  await page.click('[data-testid="train-button"]');
  await page.waitForFunction(() => /Entrenar \(en \d+ min\)/.test(document.querySelector('[data-testid="train-button"]')?.textContent ?? ""), null, { timeout: 60000 });
  const afterArm = state(id);
  check("explicit Armadura trained Armadura", afterArm.armamentHaki > 42 && afterArm.observationHaki === 41);
  check("button counts down the cooldown and is disabled", (await page.locator('[data-testid="train-button"]').isDisabled()) && /en 30 min/.test(await page.locator('[data-testid="train-button"]').innerText()));
  await page.screenshot({ path: path.join(shotsDir, "train-02-cooldown.png") });

  // The choice survives a reload.
  await page.reload();
  await page.waitForSelector('[data-testid="train-focus"]', { timeout: 10000 });
  check("the chosen focus is remembered after a reload", (await page.locator('[data-testid="train-focus"]').inputValue()) === "armament");

  // Now with a fruit: the option appears and "auto" trains the fruit when it is furthest behind.
  execSync(`npx tsx scripts/grant-fruit.ts ${id}`, { stdio: "inherit" });
  state(id, "42 41 38 30");
  await page.reload();
  await page.waitForSelector('[data-testid="train-focus"]', { timeout: 10000 });
  const values2 = await page.locator('[data-testid="train-focus"] option').evaluateAll((os) => os.map((o) => o.value));
  check("the fruit option appears for a fruit user", values2.includes("fruit"));
  await page.locator('[data-testid="train-focus"]').selectOption("auto");
  check("'auto' names the fruit as the pick (38 < 41)", /fruta/i.test(await page.locator('[data-testid="train-focus"] option[value="auto"]').innerText()));
  await page.click('[data-testid="train-button"]');
  await page.waitForFunction(() => /Entrenar \(en \d+ min\)/.test(document.querySelector('[data-testid="train-button"]')?.textContent ?? ""), null, { timeout: 60000 });
  const afterAuto = state(id);
  check("auto trained the fruit mastery and nothing else", afterAuto.fruitMastery > 38 && afterAuto.armamentHaki === 42 && afterAuto.observationHaki === 41);
  const logText = await page.locator("body").innerText();
  check("the result says what auto picked", /Entrenas lo que más se te ha quedado atrás: Dominio de la fruta/.test(logText));

  // A maxed stat can't be picked.
  state(id, "100 41 38 30");
  await page.reload();
  await page.waitForSelector('[data-testid="train-focus"]', { timeout: 10000 });
  check("a maxed stat is disabled in the list", await page.locator('[data-testid="train-focus"] option[value="armament"]').isDisabled());

  // Level caps (2026-10-04): Sebastian's real numbers — level 7 with 71 / 71 / 72. The next GET keeps 34 (the cap)
  // and banks the rest; the sheet shows the cap and the reserve, and every option reads as capped.
  state(id, "71 71 72 7");
  await page.reload();
  await page.waitForSelector('[data-testid="train-focus"]', { timeout: 10000 });
  const capped = state(id);
  check("the GET banks what is above the level cap", capped.armamentHaki === 34 && capped.bankedArmament === 37 && capped.fruitMastery === 34 && capped.bankedFruit === 38);
  const note = (await page.locator('[data-testid="level-cap-note"]').first().innerText()).replace(/\s+/g, " ");
  check("the sheet shows the cap for this level", /Tope a tu nivel: 34\/100/.test(note));
  check("the sheet shows the reserve and that it comes back", /En reserva: Observación \+37, Armadura \+37/.test(note) && /vuelve solo al subir de nivel/.test(note));
  check("every option reads as capped at this level", /tope nv\. 7/.test(await page.locator('[data-testid="train-focus"] option[value="armament"]').innerText()));
  check("with everything capped the player is told why", await page.locator('[data-testid="train-all-capped"]').isVisible());
  await page.locator('[data-testid="level-cap-note"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotsDir, "train-04-level-cap.png") });

  // Phone width: the selector and button fit without horizontal scroll.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="train-control"]');
    const r = el?.getBoundingClientRect();
    return { right: r?.right ?? 0, docW: document.documentElement.scrollWidth };
  });
  check("fits at 390 px (no horizontal overflow)", overflow.right <= 390 && overflow.docW <= 390);
  await page.locator('[data-testid="train-control"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotsDir, "train-03-phone.png") });

  check("no console errors", consoleErrors.length === 0);
  if (consoleErrors.length > 0) console.log("console errors:", consoleErrors);
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  failures++;
} finally {
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
