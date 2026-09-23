// Real-browser verification for free-text AI actions + training cooldown.
// Requires `npm run dev` running with a real OPENROUTER_API_KEY in .env.
// Usage: node scripts/ai-e2e-smoke.mjs — screenshots land in ./shots/.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
  console.log("screenshot:", name);
}

const username = "aitest" + (Date.now() % 100000);
let failures = 0;
function check(label, cond) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

try {
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "AiSmokeTester");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Bitácora", { timeout: 10000 });
  await shot("ai-01-play-screen.png");

  // Free-text explore action.
  await page.fill('textarea[placeholder*="Camino"]', "Camino por el muelle preguntando por trabajo, atento a cualquier rumor interesante.");
  await page.click('button:has-text("Actuar")');
  const feedText = await page
    .locator("text=interpretado como")
    .first()
    .textContent({ timeout: 20000 })
    .catch(() => null);
  await shot("ai-02-after-freetext-explore.png");
  check('free-text explore shows "(interpretado como: ...)"', !!feedText);

  // A combat event may have fired at random — resolve it before continuing
  // to the training-cooldown check. Flee can fail (real RNG), so retry a
  // few times, forcing a fight as a last resort to guarantee resolution.
  for (let i = 0; i < 5; i++) {
    const fleeBtn = page.locator('button:has-text("Huir")');
    if ((await fleeBtn.count()) === 0) break;
    await fleeBtn.click();
    await page.waitForTimeout(800);
    const stillThreatened = await page.locator('button:has-text("Huir")').count();
    if (stillThreatened > 0 && i === 4) {
      await page.click('button:has-text("Luchar")');
      await page.waitForTimeout(800);
      const mercyCount = await page.locator('button:has-text("Perdonar")').count();
      if (mercyCount > 0) await page.click('button:has-text("Perdonar")');
    }
  }
  await shot("ai-02b-after-resolving-combat.png");

  // Training cooldown: train once, then immediately try again via button.
  await page.waitForSelector('button:has-text("Entrenar")', { timeout: 15000 });
  await page.click('button:has-text("Entrenar")');
  await page.waitForTimeout(500);
  await shot("ai-03-after-first-train.png");
  await page.click('button:has-text("Entrenar")');
  await page.waitForTimeout(500);
  const cooldownError = await page.locator("text=Necesitas descansar antes de volver a entrenar").count();
  check("second immediate training attempt is blocked by cooldown", cooldownError > 0);
  await shot("ai-04-training-cooldown-error.png");

  // "Failed to load resource...400" is expected here: we deliberately trigger
  // a training-cooldown 400 and possibly an "unclear" classification 400.
  // Only fail on uncaught page exceptions or unexpected error types.
  const unexpected = errors.filter((e) => !e.includes("400"));
  console.log(`\nConsole/page errors: ${errors.length} (${unexpected.length} unexpected)`);
  for (const e of errors) console.log(" -", e);
  check("no unexpected console/page errors", unexpected.length === 0);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  failures++;
} finally {
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
