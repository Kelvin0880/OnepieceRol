// "Escuchar" text-to-speech button on narrator bubbles, in a real browser. No AI call needed — the narrator
// message is injected directly via scripts/force-scene-message.ts. Requires `npm run dev` running.
// Usage: node scripts/speech-ui-check.mjs
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

async function shot(page, name) {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
  console.log("screenshot:", name);
}

const username = "speech" + (Date.now() % 100000);
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
  await page.fill('input[placeholder*="Roronoa"]', "Vocero");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 10000 });
  const characterId = page.url().split("/play/")[1];

  execSync(`npx tsx scripts/force-scene-message.ts ${characterId} "El viento sopla desde el este; las gaviotas gritan sobre el muelle."`, { stdio: "inherit" });
  await page.reload();
  await page.waitForSelector('[data-testid="speak-message"]', { timeout: 10000 });

  const speakButtons = page.locator('[data-testid="speak-message"]');
  check("exactly one speak button (one narrator bubble)", (await speakButtons.count()) === 1);
  check("no speak button on the player's own bubbles", (await page.locator('.bubble-mine [data-testid="speak-message"]').count()) === 0);

  const btn = speakButtons.first();
  await shot(page, "speech-01-idle.png");
  // The button's CSS renders it all-caps (text-transform: uppercase); compare case-insensitively.
  check("starts as 'Escuchar'", /escuchar/i.test(await btn.innerText()));

  // Real edge-tts narration (2026-10-04): confirm the actual network call succeeds, not just that the button
  // toggles — a mocked/offline check would miss a broken server-side synthesis path. (The browser's own fetch
  // in src/lib/ui/speech.ts consumes the response stream to play it, so the response body is no longer
  // bufferable from here by the time it resolves — Playwright/CDP can't re-read an already-drained streamed
  // body. Byte-level proof of real audio is done separately below with a fresh request using the same session.)
  const ttsResponse = page.waitForResponse((r) => r.url().includes("/api/tts"), { timeout: 15000 });
  await btn.click();
  await page.waitForTimeout(300);
  check("toggles to 'Detener' after clicking", /detener/i.test(await btn.innerText()));
  await shot(page, "speech-02-speaking.png");
  try {
    const res = await ttsResponse;
    check("edge-tts request succeeded", res.status() === 200 && res.headers()["content-type"] === "audio/mpeg");
  } catch (e) {
    check(`edge-tts request observed (${e})`, false);
  }

  const cookieHeader = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const directTts = await fetch("http://localhost:3000/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ text: "El viento sopla desde el este sobre el muelle." }),
  });
  const directBytes = Buffer.from(await directTts.arrayBuffer());
  check("edge-tts response is real audio (>1000 bytes, same session)", directTts.ok && directBytes.length > 1000);

  await btn.click();
  await page.waitForTimeout(300);
  check("toggles back to 'Escuchar' after clicking again", /escuchar/i.test(await btn.innerText()));

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
