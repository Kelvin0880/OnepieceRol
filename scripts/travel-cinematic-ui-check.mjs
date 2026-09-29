// Real-browser check for the "zarpando" 3D travel cinematic (2026-09-29). Pure UI: travel never calls the AI
// (confirmed by reading travelCharacterInner/startVoyage), so this needs no OPENROUTER_API_KEY and burns no
// API spend, matching the owner's explicit ask for this feature. Needs `npm run dev` already running.
// Usage: node scripts/travel-cinematic-ui-check.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(cond ? `PASS: ${name}` : `FAIL: ${name} ${extra}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const stamp = Date.now() % 100000000;
const user = `travel3d_${stamp}`;
const charName = `Travel${stamp % 100000}`;

async function newPage(width) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return { ctx, page, errors };
}

async function registerAndCreate(page) {
  await page.goto(BASE);
  await page.waitForSelector('button:has-text("Crear cuenta")');
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', user);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', charName);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForURL(/\/play\//, { timeout: 30000 });
  return page.url().split("/play/")[1];
}

async function main() {
  const { page, errors } = await newPage(1280);
  const characterId = await registerAndCreate(page);
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  await page.waitForSelector('[data-testid="island-card"]');

  // --- Short hop cinematic ---
  const hopButton = page.locator('[data-testid="island-card"] >> text=Zarpar hacia').locator("..").locator("button").first();
  const hasHop = (await hopButton.count()) > 0;
  check("the starting island has at least one connected island to hop to", hasHop);
  if (hasHop) {
    await hopButton.click();
    const mounted = await page.waitForSelector('[data-testid="travel-cinematic"]', { timeout: 4000 }).then(() => true).catch(() => false);
    check("clicking a hop destination mounts the travel cinematic", mounted);
    if (mounted) {
      check("the cinematic reports a scene tier (on or off, never undefined)", ["on", "off"].includes(await page.getAttribute('[data-testid="travel-cinematic"]', "data-scene")));
      check("the cinematic is tagged kind=hop", (await page.getAttribute('[data-testid="travel-cinematic"]', "data-kind")) === "hop");
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(shots, "travel-cinematic-hop.png") });
      const unmounted = await page.waitForSelector('[data-testid="travel-cinematic"]', { state: "detached", timeout: 15000 }).then(() => true).catch(() => false);
      check("the hop cinematic auto-advances and unmounts on its own", unmounted);
      check("the island panel shows the new island underneath once the cinematic clears", await page.locator('[data-testid="island-card"]').isVisible());
    }
  }

  // --- Skip button, on a second hop (back to the origin island, if one exists) ---
  const hopBack = page.locator('[data-testid="island-card"] >> text=Zarpar hacia').locator("..").locator("button").first();
  if ((await hopBack.count()) > 0) {
    await hopBack.click();
    const mounted2 = await page.waitForSelector('[data-testid="travel-cinematic"]', { timeout: 4000 }).then(() => true).catch(() => false);
    if (mounted2) {
      await page.locator('[data-testid="travel-cinematic-skip"]').click();
      const unmounted2 = await page.waitForSelector('[data-testid="travel-cinematic"]', { state: "detached", timeout: 4000 }).then(() => true).catch(() => false);
      check("the skip button dismisses the cinematic immediately", unmounted2);
    } else {
      check("second hop offered a cinematic to skip", false, "(no connected island button found for the second hop)");
    }
  }

  check("no unexpected console/page errors across both hops", errors.length === 0, JSON.stringify(errors));

  // --- Reduced motion: reuse the same authenticated page (a fresh context has no session cookie) ---
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForSelector('[data-testid="island-card"]');
  const rmHop = page.locator('[data-testid="island-card"] >> text=Zarpar hacia').locator("..").locator("button").first();
  if ((await rmHop.count()) > 0) {
    await rmHop.click();
    const rmMounted = await page.waitForSelector('[data-testid="travel-cinematic"]', { timeout: 4000 }).then(() => true).catch(() => false);
    check("reduced motion still mounts the (CSS-only) cinematic overlay", rmMounted);
    if (rmMounted) {
      check("reduced motion renders no WebGL canvas", (await page.locator('[data-testid="travel-cinematic"] canvas').count()) === 0);
      const rmUnmounted = await page.waitForSelector('[data-testid="travel-cinematic"]', { state: "detached", timeout: 3000 }).then(() => true).catch(() => false);
      check("reduced motion clears quickly (short fixed delay, not the full clip length)", rmUnmounted);
    }
  } else {
    check("reduced-motion pass had a connected island to hop to", false);
  }
  await page.emulateMedia({ reducedMotion: null });

  // --- Phone viewport sanity: same authenticated page, just resized ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForSelector('[data-testid="island-card"]');
  const phoneHop = page.locator('[data-testid="island-card"] >> text=Zarpar hacia').locator("..").locator("button").first();
  if ((await phoneHop.count()) > 0) {
    await phoneHop.click();
    const phoneMounted = await page.waitForSelector('[data-testid="travel-cinematic"]', { timeout: 4000 }).then(() => true).catch(() => false);
    check("the cinematic mounts and fits at phone width (390px)", phoneMounted);
    if (phoneMounted) {
      await page.waitForTimeout(700);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      check("no horizontal overflow at 390px while the cinematic is up", sw <= 391, `(scrollWidth ${sw})`);
      await page.screenshot({ path: path.join(shots, "travel-cinematic-phone.png") });
      await page.waitForSelector('[data-testid="travel-cinematic"]', { state: "detached", timeout: 15000 }).catch(() => {});
    }
  } else {
    check("phone pass had a connected island to hop to", false);
  }
  check("no unexpected console/page errors across the whole run", errors.length === 0, JSON.stringify(errors));

  await browser.close();
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
