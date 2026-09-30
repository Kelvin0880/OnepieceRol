// Live verification against the REAL OpenRouter model (no REFEREE_STUB) for the fix to a real bug: a fight
// stayed stuck in phase "fighting" forever after the referee narrated the rival dead but never declared
// "derrotados" (Barbosa vs Novato Finn, 2026-09-30). forceDefeatOnEmptyIntent (src/lib/engine/referee.ts) is
// already proven deterministically against the exact real transcript text in referee.test.ts; this script
// proves the live, end-to-end path: force an enemy already critically low on HP (scripts/force-near-death-fight.ts,
// matching the real fight's numbers right before it got stuck) and confirm a finishing free-text move reliably
// concludes the fight (phase -> "victory", mercy choice shown) within a handful of real AI exchanges, for
// several independent characters — it must never get permanently stuck.
// Requires `npm run dev` running with a real OPENROUTER_API_KEY. Usage: node scripts/finishing-blow-check.mjs
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

function pendingState(characterId) {
  const out = execSync(`npx tsx scripts/check-pending-encounter.ts ${characterId}`, { encoding: "utf8" });
  return out.trim().split("\n").pop();
}

async function act(page, text) {
  await page.waitForSelector("textarea:not([disabled])", { timeout: 150000 });
  await page.fill("textarea", text);
  await page.click('button:has-text("Actuar")');
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 150000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function runOne(browser, idx) {
  const username = `finish${idx}${Date.now() % 100000}`;
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
    await page.fill('input[placeholder*="Roronoa"]', `Finisher${idx}`);
    await page.click('button:has-text("Pirata")');
    await page.click('button:has-text("Espadachín")');
    await page.click('button:has-text("Zarpar")');
    await page.waitForSelector("text=Escena", { timeout: 10000 });
    const characterId = page.url().split("/play/")[1];

    execSync(`npx tsx scripts/force-near-death-fight.ts ${characterId}`, { stdio: "inherit" });
    await page.reload();
    await page.waitForSelector("text=Sigues luchando contra", { timeout: 10000 });

    let resolved = false;
    let rounds = 0;
    while (!resolved && rounds < 5) {
      await act(page, "Con todas mis fuerzas lanzo un golpe final directo a su pecho, buscando acabar con esto de una vez.");
      rounds++;
      const state = pendingState(characterId);
      console.log(`  [char ${idx}] round ${rounds}: ${state}`);
      resolved = state.startsWith("phase=victory");
      if (state === "phase=none") break; // enemy won or something else ended it outright (also fine — not stuck)
    }
    await page.screenshot({ path: path.join(shotsDir, `finish-${idx}-final.png`), fullPage: true });
    check(`char ${idx}: fight concluded within ${rounds} round(s), not left stuck`, resolved || pendingState(characterId) === "phase=none");
    if (resolved) {
      const mercyVisible = await page.locator("text=derrotado y a tu merced").or(page.locator("text=Perdonar")).or(page.locator("text=Rematar")).first().isVisible().catch(() => false);
      check(`char ${idx}: mercy/finish choice is shown once concluded`, mercyVisible);
    }
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch();
try {
  for (let i = 1; i <= 3; i++) await runOne(browser, i);
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  failures++;
} finally {
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
