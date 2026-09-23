// Real-time push check (2026-09-24): player B must see player A's action WITHOUT reloading and
// well before any poll could deliver it (the safety-net poll is 30s while the stream is healthy).
// Needs `npm run dev`. Usage: node scripts/realtime-check.mjs
import { chromium } from "playwright";
import { spawnSync } from "child_process";

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
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `${tag}_${Date.now()}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', `Pj${tag}`);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 15000 });
  const id = page.url().split("/play/")[1].split(/[?#]/)[0];
  return { page, id };
}

try {
  const a = await newPlayer("pushA");
  const b = await newPlayer("pushB");
  fixture("territory", a.id);
  fixture("territory", b.id);
  await a.page.reload();
  await b.page.reload();
  await a.page.waitForSelector('[data-testid="territory-panel"]', { timeout: 15000 });
  await b.page.waitForSelector('[data-testid="territory-panel"]', { timeout: 15000 });
  // Give both EventSource connections a moment to open.
  await b.page.waitForTimeout(2500);
  check("B starts with no muster listed", !(await b.page.textContent('[data-testid="territory-panel"]')).includes("Hueste reunida"));

  const t0 = Date.now();
  await a.page.click('button:has-text("Sumarme a la hueste")');
  await b.page.waitForSelector("text=Hueste reunida", { timeout: 6000 });
  const dt = Date.now() - t0;
  check(`B saw A's action without reloading, in ${dt} ms (poll would take up to 30 s)`, dt < 5000);

  const stream = await b.page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const es = new EventSource(`/api/characters/${id}/stream`);
        es.addEventListener("ready", () => {
          es.close();
          resolve("ready");
        });
        setTimeout(() => resolve("timeout"), 4000);
      }),
    b.id
  );
  check("the stream endpoint opens for the owner", stream === "ready");
  const status = await b.page.evaluate(async (id) => (await fetch(`/api/characters/${id}/stream`, { headers: { Accept: "text/event-stream" }, signal: AbortSignal.timeout(1500) }).then((r) => r.status).catch(() => 200)), a.id);
  check("another player's character stream is refused", status === 404 || status === 401 || status === 200 === false);
} catch (err) {
  console.error(err);
  failures++;
}
await browser.close();
console.log(failures === 0 ? "ALL PASS" : failures + " FAILED");
process.exit(failures === 0 ? 0 : 1);
