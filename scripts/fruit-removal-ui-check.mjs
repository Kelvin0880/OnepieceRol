// Isla Kairos fruit removal (2026-10-04) in a real browser: the card only exists on the island, explains the cost,
// needs the fruit's exact name, removes it for real and the sheet shows "Sin fruta del diablo" afterwards.
// No AI call anywhere on this path. Requires `npm run dev` running. Usage: node scripts/fruit-removal-ui-check.mjs
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

const username = "kairos" + (Date.now() % 100000);
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
  await page.waitForSelector("text=Tus personajes", { timeout: 15000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "Peregrina");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 15000 });
  const id = page.url().split("/play/")[1];

  check("no ritual card away from Isla Kairos", (await page.locator('[data-testid="fruit-removal-card"]').count()) === 0);

  const setup = JSON.parse(execSync(`npx tsx scripts/kairos-setup.ts ${id}`, { encoding: "utf8" }).trim().split("\n").pop());
  await page.reload();
  await page.waitForSelector('[data-testid="fruit-removal-card"]', { timeout: 15000 });
  const card = page.locator('[data-testid="fruit-removal-card"]');
  check("the card shows on Isla Kairos with the fruit", (await card.innerText()).includes(setup.fruit));
  check("the card states the price", /฿/.test(await page.locator('[data-testid="fruit-removal-price"]').innerText()));
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotsDir, "kairos-01-card.png") });

  await page.click('[data-testid="fruit-removal-open"]');
  const submit = page.locator('[data-testid="fruit-removal-submit"]');
  check("the ritual stays locked until the exact name is typed", await submit.isDisabled());
  await page.fill('[data-testid="fruit-removal-input"]', "otra cosa");
  check("a wrong name keeps it locked", await submit.isDisabled());
  await page.fill('[data-testid="fruit-removal-input"]', setup.fruit);
  check("the exact name unlocks it", !(await submit.isDisabled()));
  await page.screenshot({ path: path.join(shotsDir, "kairos-02-confirm.png") });

  await submit.click();
  await page.waitForSelector('[data-testid="fruit-removal-done"]', { timeout: 30000 });
  check("the result tells the story of the ritual", /Aguas Quietas/.test(await page.locator('[data-testid="fruit-removal-done"]').innerText()));
  await page.waitForFunction(() => document.body.innerText.includes("Sin fruta del diablo"), null, { timeout: 30000 });
  check("the sheet now reads 'Sin fruta del diablo'", true);
  check("the 'can't swim' line is gone", !(await page.locator("body").innerText()).includes("No puede nadar"));
  await page.screenshot({ path: path.join(shotsDir, "kairos-03-done.png"), fullPage: true });

  // Phone width.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(300);
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("fits at 390 px (no horizontal overflow)", docW <= 390);

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
