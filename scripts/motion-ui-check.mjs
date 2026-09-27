// Interface/animation layer check (2026-09-27): drives the Motion-based UI in a real browser at phone (390) and
// desktop (1280) widths and with "reduce motion" on, and asserts the animations never get in the way:
// sheets close by swipe, Escape and "Cerrar"; tabs switch; losing life flashes the screen edges and floats a
// number; low life pulses; the 3D compass, poster, encounter box and icons render; no overflow, no page errors.
// Needs `npm run dev` (JUDGE_STUB=1 REFEREE_STUB=1 recommended). Usage: node scripts/motion-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
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
const user = `motion_${stamp}`;
const charName = `Motion${stamp % 100000}`;
let characterId = null;

const dialogGone = (page, timeout = 4000) =>
  page
    .waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout })
    .then(() => true)
    .catch(() => false);

async function newPage(width, opts = {}) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const shot = (n, fullPage = false) => page.screenshot({ path: path.join(shots, `motion-${width}-${n}.png`), fullPage });
  const fits = async (n) => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`${n} fits ${width}px`, sw <= width + 1, `(scrollWidth ${sw})`);
  };
  return { ctx, page, errors, shot, fits };
}

async function login(page) {
  await page.goto(BASE);
  await page.waitForSelector('form button[type="submit"]');
  await page.fill('input[placeholder="Nombre de usuario"]', user);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button[type="submit"]');
  await page.waitForSelector("text=Tus personajes");
}

async function openPanel(page, testId) {
  await page.locator(`[data-testid="${testId}"]`).first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(450);
}

async function phone() {
  const { ctx, page, errors, shot, fits } = await newPage(390);

  await page.goto(BASE);
  await page.waitForSelector('button:has-text("Crear cuenta")');
  await page.waitForTimeout(700);
  await shot("01-login");
  check("the 3D compass renders on the landing", (await page.locator('[data-testid="compass-3d"]').count()) === 1);
  const head = await page.evaluate(() => [...document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]')].map((l) => l.getAttribute("rel")));
  check("favicon, apple icon and manifest are linked", head.includes("icon") && head.includes("apple-touch-icon") && head.includes("manifest"), JSON.stringify(head));
  const manifest = await (await page.request.get(`${BASE}/manifest.webmanifest`)).json();
  check("the manifest names the game and has a maskable icon", manifest.name === "Grand Line RPG" && manifest.icons.some((i) => i.purpose === "maskable"));
  const icon = await page.request.get(`${BASE}/icons/icon-192.png`);
  check("the home-screen icon is served", icon.ok() && icon.headers()["content-type"] === "image/png");
  await fits("login");

  const registerTab = page.locator('button:has-text("Crear cuenta")').first();
  await registerTab.click();
  check("the login switch marks the chosen side", (await registerTab.getAttribute("aria-pressed")) === "true");
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
  characterId = page.url().split("/play/")[1];
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  await page.waitForTimeout(900);
  await shot("02-play");
  await fits("play");
  check("the wanted poster is pinned on the sheet", (await page.locator('[data-testid="wanted-poster"]').count()) === 1);

  // Sheet: tabs, then swipe the handle down to close.
  await openPanel(page, "inventory-open");
  await page.click('[data-testid="inv-tab-shop"]');
  await page.waitForTimeout(350);
  check("a tab switch moves the marker to the chosen tab", (await page.getAttribute('[data-testid="inv-tab-shop"]', "aria-pressed")) === "true" && (await page.getAttribute('[data-testid="inv-tab-bag"]', "aria-pressed")) === "false");
  await shot("03-inventory-sheet");
  await fits("inventory sheet");
  const handle = await page.locator('[data-testid="sheet-handle"]').boundingBox();
  check("the sheet has a drag handle on phones", !!handle);
  if (handle) {
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + i * 40);
    await page.mouse.up();
  }
  check("swiping the sheet down closes it", await dialogGone(page));

  // "Cerrar" inside a panel (parent-driven close) and the formerly unstyled search/invite inputs.
  await openPanel(page, "crew-open-header");
  await page.click('[data-testid="crew-tab-invite"]');
  await page.waitForTimeout(300);
  const inputBg = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] input.input');
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  check("crew inputs use the dark field style", inputBg === "rgb(11, 21, 32)", String(inputBg));
  await shot("04-crew-invite");
  await page.click('[role="dialog"] button:has-text("Cerrar")');
  check("«Cerrar» closes the panel through its exit animation", await dialogGone(page));

  await openPanel(page, "voyage-open");
  await page.keyboard.press("Escape");
  check("Escape closes a panel", await dialogGone(page));

  // Life drops: red flash on the screen edges and a floating "-N" over the life bar.
  execSync(`npx tsx scripts/set-character-hp.ts ${characterId} 60`, { stdio: "ignore" });
  await page.click('button:has-text("Entrenar")');
  const flashed = await page.waitForSelector('[data-testid="hit-vignette"]', { state: "attached", timeout: 15000 }).then(() => true).catch(() => false);
  check("losing life flashes the screen edges", flashed);
  const floated = await page.waitForFunction(() => [...document.querySelectorAll(".float-number")].some((n) => n.textContent?.startsWith("-")), null, { timeout: 3000 }).then(() => true).catch(() => false);
  check("the lost life floats over the bar as a negative number", floated);
  await page.waitForTimeout(150);
  await shot("05-hit");
  const gone = await page.waitForSelector('[data-testid="hit-vignette"]', { state: "detached", timeout: 3000 }).then(() => true).catch(() => false);
  check("the flash clears itself", gone);

  execSync(`npx tsx scripts/set-character-hp.ts ${characterId} 15`, { stdio: "ignore" });
  await page.reload();
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  await page.waitForTimeout(600);
  check("life at or under a quarter keeps a red vignette", (await page.locator('[data-testid="low-life-vignette"]').count()) === 1);
  check("the life bars pulse when critical", (await page.locator("[data-critical]").count()) >= 1);
  await shot("06-low-life");
  execSync(`npx tsx scripts/set-character-hp.ts ${characterId} 100`, { stdio: "ignore" });

  // A fight offer lands with the 3D encounter box.
  execSync(`npx tsx scripts/force-threat-encounter.ts ${characterId}`, { stdio: "ignore" });
  await page.reload();
  await page.waitForSelector('[data-testid="encounter-box"]', { timeout: 30000 });
  await page.locator('[data-testid="encounter-box"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await shot("07-encounter");
  const upright = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="encounter-box"]');
    return { drawn: el.getBoundingClientRect().height, real: el.offsetHeight };
  });
  check("the encounter box ends its 3D entrance upright", Math.abs(upright.drawn - upright.real) < 2, JSON.stringify(upright));
  await page.click('[data-testid="decline-threat"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="encounter-box"]'), null, { timeout: 15000 }).catch(() => {});

  await page.goto(`${BASE}/codex`);
  await page.waitForSelector("h1");
  await page.waitForTimeout(1200);
  await fits("codex");
  await page.click('[data-testid="codex-tab-players"]');
  await page.waitForTimeout(300);
  check("codex tabs switch", (await page.getAttribute('[data-testid="codex-tab-players"]', "aria-pressed")) === "true");
  await shot("08-codex");
  for (const tab of ["residents", "prison"]) {
    await page.click(`[data-testid="codex-tab-${tab}"]`);
    await page.waitForTimeout(2000);
    await fits(`codex ${tab} tab`);
  }

  await page.goto(`${BASE}/news`);
  await page.waitForSelector("h1");
  await page.waitForTimeout(800);
  await fits("news");

  check("no page or console errors on the phone", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

async function desktop() {
  const { ctx, page, errors, shot, fits } = await newPage(1280);
  await login(page);
  await page.waitForTimeout(700);
  await shot("01-characters");
  await page.goto(`${BASE}/play/${characterId}`);
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  await page.waitForTimeout(900);
  await fits("play");

  const poster = page.locator('[data-testid="wanted-poster"]');
  const box = await poster.boundingBox();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
  await page.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.12);
  await page.waitForTimeout(500);
  const tilt = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="wanted-poster"]').parentElement).transform);
  check("the poster tilts toward the mouse on desktop", tilt !== "none" && tilt.startsWith("matrix3d"), tilt);
  await shot("02-poster-tilt");
  await page.mouse.move(5, 5);

  await page.locator('[data-testid="inventory-open"]').first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(60);
  await shot("03-modal-opening");
  await page.waitForTimeout(500);
  await shot("04-modal-open");
  check("no drag handle on desktop", !(await page.locator('[data-testid="sheet-handle"]').isVisible()));
  await page.mouse.click(8, 450);
  check("clicking the backdrop closes the panel", await dialogGone(page));

  await openPanel(page, "power-open");
  await page.waitForSelector('[data-testid="sov-tab-war"]', { timeout: 15000 });
  await page.click('[data-testid="sov-tab-war"]');
  await page.waitForTimeout(350);
  check("power panel tabs switch", (await page.getAttribute('[data-testid="sov-tab-war"]', "aria-pressed")) === "true");
  await shot("05-power-tabs");
  await page.click('[role="dialog"] button:has-text("Cerrar")');
  check("the power panel closes", await dialogGone(page));

  check("no page or console errors on desktop", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

async function reducedMotion() {
  const { ctx, page, errors } = await newPage(390, { reducedMotion: "reduce" });
  await login(page);
  await page.goto(`${BASE}/play/${characterId}`);
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  await openPanel(page, "inventory-open");
  await page.keyboard.press("Escape");
  check("with reduced motion a panel still opens and closes", await dialogGone(page));
  check("no page errors with reduced motion", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

try {
  await phone();
  await desktop();
  await reducedMotion();
} catch (e) {
  failures++;
  console.log("FAIL: motion check crashed", e.message);
} finally {
  await browser.close();
  if (characterId) console.log("characterId", characterId);
  console.log(failures === 0 ? "PASS motion ui check" : `FAIL motion ui check (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}
