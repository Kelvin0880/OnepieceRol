// Real-browser verification for the free-roam roleplay pivot: "narrate" as
// the default free-text action, round-by-round combat via resolveExchange,
// the Escena chat panel, and the training cooldown. Requires `npm run dev`
// running with a real OPENROUTER_API_KEY in .env.
// Usage: node scripts/ai-e2e-smoke.mjs — screenshots land in ./shots/.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
  console.log("screenshot:", name);
}

async function act(text) {
  await page.fill('textarea', text);
  await page.click('button:has-text("Actuar")');
  // Free-text actions can chain 1-2 real AI calls (classify + narrate, or
  // classify + tactic-quality + combat narration) against free-tier models,
  // so wait for the "Pensando..." indicator to clear rather than a fixed sleep.
  await page.waitForSelector("text=Pensando...", { state: "hidden", timeout: 30000 }).catch(() => {});
  // A real player pauses to read between actions — space calls out to stay
  // well under OpenRouter's free-tier per-model rate limit during this test.
  await page.waitForTimeout(3000);
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
  await page.waitForSelector("text=Escena", { timeout: 10000 });
  await shot("ai-01-play-screen.png");

  // The exact bug the user hit live: free-roam social/roleplay text must be
  // treated as "narrate" (pure scene, no engine call) instead of rejected
  // as unclear, and instead of silently spending an "explore" turn.
  await act("Estaría mirando un bar, y entraría a ver si alguna chica quiere conmigo.");
  await shot("ai-02-after-freetext-bar-scene.png");

  const sceneBubbles = await page.locator("div.whitespace-pre-line").count();
  check("free-roam bar/social text produced a narrator reply in the Escena panel", sceneBubbles >= 1);
  check('no "(interpretado como: ...)" noise for a plain narrate turn', !(await page.locator("text=interpretado como: Explorar").isVisible().catch(() => false)));
  check("no unclear/blocked error shown for free-roam text", !(await page.locator("text=No logro entender").isVisible().catch(() => false)));

  // Now force a decisive, risky commitment — should classify as "explore"
  // and may trigger combat.
  let combatTriggered = false;
  for (let attempt = 0; attempt < 3 && !combatTriggered; attempt++) {
    await act("Me interno en la isla a explorar a fondo, buscando problemas si hace falta.");
    combatTriggered = await page.locator("text=Te enfrentas a").isVisible().catch(() => false);
  }

  if (combatTriggered) {
    await shot("ai-03-combat-triggered.png");
    // Round-by-round combat: attack repeatedly with a described tactic,
    // narrating the enemy's response each time, until it resolves.
    let rounds = 0;
    while (rounds < 8) {
      const stillFighting = await page.locator("text=Sigues luchando contra").or(page.locator("text=Te enfrentas a")).isVisible().catch(() => false);
      if (!stillFighting) break;
      await act(rounds === 0 ? "Aprovecho su distracción y ataco su punto débil con un golpe rápido." : "Sigo presionando el ataque sin dejarle respirar.");
      rounds++;
    }
    await shot("ai-04-after-combat-rounds.png");
    check("combat resolved within a reasonable number of exchanges", rounds < 8);

    const victoryVisible = await page.locator("text=está derrotado y a tu merced").isVisible().catch(() => false);
    if (victoryVisible) {
      await act("Le perdono la vida y le advierto que no vuelva a cruzarse conmigo.");
      await page.waitForTimeout(1500);
    }
  } else {
    console.log("(no combat triggered by random events in 3 attempts — skipping round-by-round combat check)");
  }
  await shot("ai-05-final-state.png");

  // Training cooldown: train once (button, kept for the simple/mechanical
  // actions), then immediately try again.
  const trainVisible = await page.locator('button:has-text("Entrenar")').isVisible().catch(() => false);
  if (trainVisible) {
    await page.click('button:has-text("Entrenar")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Entrenar")');
    await page.waitForTimeout(500);
    const cooldownError = await page.locator("text=Necesitas descansar antes de volver a entrenar").count();
    check("second immediate training attempt is blocked by cooldown", cooldownError > 0);
    await shot("ai-06-training-cooldown-error.png");
  } else {
    console.log("(character not in a free state to train — skipping cooldown check)");
  }

  // The old "Explorar" / "Luchar" / "Huir" / "Perdonar" / "Rematar" buttons
  // must be gone — only Entrenar/Descansar stay as quick buttons.
  const explorarButton = await page.locator('button:has-text("Explorar")').count();
  check('the "Explorar" button was removed (free text is the only way now)', explorarButton === 0);

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
