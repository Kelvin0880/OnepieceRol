// Real-browser check (390px) of character portraits: upload on the poster, visible in the list and to other players (codex), fake files rejected.
// Needs `npm run dev`. Usage: node scripts/portrait-ui-check.mjs
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
// 4x4 red PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==", "base64");

const browser = await chromium.launch();
async function register(prefix) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `${prefix}_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  return page;
}
try {
  const name = `Foto${Date.now() % 100000}`;
  const page = await register("foto");
  await page.click('a:has-text("Nuevo personaje")');
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 30000 });
  const id = page.url().split("/play/")[1];

  check("no photo yet", (await page.locator('[data-testid="poster-photo"]').count()) === 0);
  await page.setInputFiles('[data-testid="portrait-file"]', { name: "yo.png", mimeType: "image/png", buffer: PNG });
  await page.waitForSelector('[data-testid="poster-photo"]', { timeout: 15000 });
  check("the photo appears on the poster", true);
  const ok = await page.evaluate(async (i) => { const r = await fetch(`/api/characters/${i}/portrait`); return [r.status, r.headers.get("content-type")]; }, id);
  check("the picture is served publicly as an image", ok[0] === 200 && String(ok[1]).startsWith("image/"), JSON.stringify(ok));
  await page.screenshot({ path: path.join(shots, "portrait-01-sheet.png"), fullPage: true });

  const bad = await page.evaluate(async (i) => {
    const r = await fetch(`/api/characters/${i}/portrait`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: "data:image/png;base64," + btoa("<svg onload=alert(1)>") }) });
    return r.status;
  }, id);
  check("a fake image is refused", bad === 400, String(bad));

  await page.goto("http://localhost:3000");
  await page.waitForSelector('[data-testid="poster-photo"]', { timeout: 15000 });
  check("the photo shows in the character list", true);
  await page.screenshot({ path: path.join(shots, "portrait-02-list.png"), fullPage: true });

  const other = await register("miron");
  const stranger = await other.evaluate(async (i) => (await fetch(`/api/characters/${i}/portrait`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: null }) })).status, id);
  check("another player cannot change it", stranger === 400, String(stranger));
  await other.goto("http://localhost:3000/codex");
  await other.click('[data-testid="codex-tab-players"]');
  await other.waitForSelector('[data-testid="codex-player-photo"]', { timeout: 15000 });
  check("other players see it in the codex", true);
  await other.screenshot({ path: path.join(shots, "portrait-03-codex.png"), fullPage: true });

  await page.goto(`http://localhost:3000/play/${id}`);
  await page.waitForSelector("text=Quitar foto");
  await page.click('button:has-text("Quitar foto")');
  await page.waitForSelector('[data-testid="poster-photo"]', { state: "detached", timeout: 15000 });
  check("the photo can be removed", true);
  check("fits 390px", (await page.evaluate(() => document.documentElement.scrollWidth)) <= 391);
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
