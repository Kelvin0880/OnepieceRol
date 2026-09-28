// Landing page check (GitHub Pages portada, built from landing/ into docs/): serves docs/ under /OnepieceRol/
// like Pages does and drives it in a real browser at desktop (1280) and phone (390) sizes and with reduced motion.
// Asserts the 3D voyage renders, the real game numbers show, the demo scene plays to the end, faction cards flip,
// the wanted poster downloads as a PNG (and takes a photo), the fruit roulette spins, the server wake-up reports
// ready, Guía/Mapa are reachable, nothing overflows at 390 px and there are no page errors.
// Needs a fresh build: `npm --prefix landing run build`. No game server needed (the ping is answered in the browser).
// Usage: node scripts/landing-ui-check.mjs
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { serveDocs } from "./lib/serve-docs.mjs";

const shots = path.resolve(process.cwd(), "shots", "landing");
fs.mkdirSync(shots, { recursive: true });
const data = JSON.parse(fs.readFileSync("landing/src/data/game-data.json", "utf8"));
const GAME = "https://grand-line-rpg-qgkv.onrender.com";
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(cond ? `PASS: ${name}` : `FAIL: ${name} ${extra}`);
  if (!cond) failures++;
};

const exe = process.env.CHROME_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const { server, url } = await serveDocs(4610);

async function newPage(viewport, opts = {}) {
  // ignoreHTTPSErrors: sandboxes put a TLS proxy in front of Google Fonts that Chromium does not trust.
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true, acceptDownloads: true, ...opts });
  await ctx.route(`${GAME}/api/ping`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"ok":true}' }),
  );
  await ctx.route(`${GAME}/`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>game</title>" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return { ctx, page, errors };
}

const scrollTo = (page, id) => page.evaluate((sid) => document.getElementById(sid)?.scrollIntoView({ block: "start" }), id);
const shot = (page, name) => page.screenshot({ path: path.join(shots, `check-${name}.png`) });

try {
  // ---------- desktop ----------
  {
    const { ctx, page, errors } = await newPage({ width: 1280, height: 800 });
    await page.goto(`${url}?nointro=1&nosmooth=1&capture=1`, { waitUntil: "load" });
    check("desktop: page title names the game", (await page.title()).includes("Grand Line RPG"));
    const ogImage = await page.getAttribute('meta[property="og:image"]', "content");
    check("desktop: share image is an absolute URL", ogImage?.startsWith("https://kelvin0880.github.io/OnepieceRol/og.jpg") ?? false, ogImage ?? "");
    const ogRes = await page.request.get(`${url}og.jpg`);
    check("desktop: share image is published", ogRes.ok() && (await ogRes.body()).length > 40_000);
    const ready = await page.waitForSelector('[data-ready="true"]', { timeout: 90_000 }).then(() => true).catch(() => false);
    check("desktop: the 3D sea loads", ready);
    const tier = await page.getAttribute("[data-scene]", "data-scene");
    check("desktop: a desktop gets a 3D tier", ["high", "medium", "low"].includes(tier ?? ""), tier ?? "");
    await page.waitForTimeout(2500);
    await shot(page, "desk-hero");

    for (const id of ["top", "juego", "mundo", "viaje", "reverse-mountain", "paradise", "cartel", "nuevo-mundo", "frutas", "sistemas", "zarpa"]) {
      check(`desktop: section #${id} exists`, (await page.locator(`#${id}`).count()) === 1);
    }

    await scrollTo(page, "mundo");
    const expected = [data.counts.islands, data.counts.fruits, data.counts.canon, data.counts.residents].map((n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    // The tickers count up from zero; wait until they have landed on the real numbers.
    await page
      .waitForFunction(
        (want) => {
          const text = [...document.querySelectorAll('[data-testid="stat-card"]')].map((c) => c.textContent).join(" ");
          return want.every((w) => new RegExp(`(^|\\D)${w.replace(".", "\\.")}(\\D|$)`).test(text));
        },
        expected,
        { timeout: 15_000 },
      )
      .catch(() => null);
    const stats = await page.locator('[data-testid="stat-card"]').allInnerTexts();
    check("desktop: six stat cards", stats.length === 6, String(stats.length));
    const joined = stats.join(" ");
    for (const shown of expected) check(`desktop: stat shows the real number ${shown}`, new RegExp(`(^|\\D)${shown.replace(".", "\\.")}(\\D|$)`).test(joined), joined.slice(0, 120));

    await scrollTo(page, "juego");
    const demoDone = await page.waitForSelector('[data-testid="demo-replay"]', { timeout: 90_000 }).then(() => true).catch(() => false);
    check("desktop: the demo scene plays to the end", demoDone);
    const phoneText = await page.locator('[data-testid="demo-phone"]').innerText();
    check("desktop: the demo ends with the player's life at 91", phoneText.includes("91/100"), phoneText.slice(0, 200));
    check("desktop: the demo never shows the rival's life", !/Dorian[^\n]*\d+\/\d+/.test(phoneText));
    await shot(page, "desk-demo");

    await scrollTo(page, "viaje");
    await page.waitForTimeout(1500);
    const cards = page.locator('[data-testid="faction-card"]');
    check("desktop: five faction cards", (await cards.count()) === 5);
    await cards.first().click();
    await page.waitForTimeout(900);
    check("desktop: a faction card flips on click", (await cards.first().getAttribute("aria-pressed")) === "true");
    await shot(page, "desk-factions");

    await scrollTo(page, "cartel");
    await page.waitForTimeout(2200);
    const canvas = page.locator('[data-testid="wanted-canvas"]');
    const before = await canvas.evaluate((c) => c.toDataURL());
    await page.fill('[data-testid="wanted-name"]', "Monkey D. Prueba");
    await page.waitForTimeout(900);
    const after = await canvas.evaluate((c) => c.toDataURL());
    check("desktop: the poster redraws with the typed name", before !== after);
    const label = await canvas.getAttribute("aria-label");
    check("desktop: the poster is labelled with the name", label?.includes("Monkey D. Prueba") ?? false, label ?? "");
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15_000 }), page.click('[data-testid="wanted-download"]')]);
    const posterPath = path.join(shots, "check-poster.png");
    await download.saveAs(posterPath);
    check("desktop: the poster downloads with a clean file name", download.suggestedFilename() === "se-busca-monkey-d-prueba.png", download.suggestedFilename());
    const png = fs.readFileSync(posterPath);
    check("desktop: the downloaded poster is a real PNG", png.subarray(1, 4).toString() === "PNG" && png.length > 50_000, String(png.length));
    await page.setInputFiles('[data-testid="wanted-photo"]', path.join(shots, "check-desk-hero.png"));
    await page.waitForTimeout(1200);
    const withPhoto = await canvas.evaluate((c) => c.toDataURL());
    check("desktop: a photo goes onto the poster", withPhoto !== after);
    await shot(page, "desk-poster");

    await scrollTo(page, "frutas");
    await page.waitForTimeout(2500);
    const spin = page.locator('[data-testid="fruit-spin"]');
    await spin.click();
    const settled = await page
      .waitForFunction(() => !document.querySelector('[data-testid="fruit-spin"]')?.hasAttribute("disabled"), null, { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);
    check("desktop: the fruit roulette spins and settles", settled);
    const fruitName = await page.locator('[data-testid="fruit-card"] h3').first().innerText();
    check("desktop: the roulette lands on a real catalogue fruit", data.fruits.some((f) => f.name === fruitName), fruitName);
    await shot(page, "desk-fruit");

    await scrollTo(page, "zarpa");
    const woke = await page
      .waitForFunction(() => document.querySelector('[data-testid="wake-status"]')?.getAttribute("data-status") === "ready", null, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check("desktop: the game server wake-up reports ready", woke);
    const playHref = await page.getAttribute('[data-testid="finale-play"]', "href");
    check("desktop: the main call to action opens the game", playHref === GAME, playHref ?? "");
    await page.waitForTimeout(2500);
    await shot(page, "desk-finale");

    const credit = (await page.locator('[data-testid="creator"]').textContent()) ?? "";
    check("desktop: the footer credits the creator", credit.includes("Kelvin Piña"), credit);
    check("desktop: the page names its author for search engines", (await page.getAttribute('meta[name="author"]', "content")) === "Kelvin Piña");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    check("desktop: structured data names the game and its creator", ld.name === "Grand Line RPG" && ld.author?.name === "Kelvin Piña");
    for (const doc of ["guia.html", "mapa.html"]) {
      const res = await page.request.get(`${url}${doc}`);
      check(`desktop: ${doc} is still published next to the landing`, res.ok());
    }
    check("desktop: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---------- 3D alone renders a real picture ----------
  {
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    await page.goto(`${url}?clean=1&voyage=0&tier=high&capture=1`, { waitUntil: "load" });
    await page.waitForSelector('[data-ready="true"]', { timeout: 90_000 });
    await page.waitForTimeout(2500);
    const jpg = await page.screenshot({ type: "jpeg", quality: 80 });
    fs.writeFileSync(path.join(shots, "check-3d-only.jpg"), jpg);
    check("3D: the scene draws detail, not a flat colour", jpg.length > 60_000, String(jpg.length));
    await ctx.close();
  }

  // ---------- phone ----------
  {
    const { ctx, page, errors } = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
    await page.goto(`${url}?nointro=1&capture=1`, { waitUntil: "load" });
    await page.waitForSelector('[data-ready="true"]', { timeout: 90_000 }).catch(() => null);
    await page.waitForTimeout(2500);
    const tier = await page.getAttribute("[data-scene]", "data-scene");
    check("phone: a lighter 3D tier on touch screens", tier === "medium" || tier === "low", tier ?? "");
    await shot(page, "phone-hero");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    check("phone: no horizontal overflow at 390 px", width <= 390, String(width));
    const h1 = await page.locator("h1").boundingBox();
    check("phone: the title fits the screen", !!h1 && h1.x >= 0 && h1.x + h1.width <= 390, JSON.stringify(h1));
    check("phone: the play button is reachable", await page.locator('[data-testid="nav-play"]').isVisible());
    for (const id of ["juego", "viaje", "cartel", "frutas", "zarpa"]) {
      await scrollTo(page, id);
      await page.waitForTimeout(1800);
      await shot(page, `phone-${id}`);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      check(`phone: no overflow at #${id}`, w <= 390, String(w));
    }
    check("phone: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---------- reduced motion ----------
  {
    const { ctx, page, errors } = await newPage({ width: 1280, height: 800 }, { reducedMotion: "reduce" });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    check("reduced motion: no 3D, the painted sky instead", (await page.getAttribute("[data-scene]", "data-scene")) === "none");
    check("reduced motion: no WebGL canvas at all", (await page.locator("[data-scene] canvas").count()) === 0);
    check("reduced motion: the title is there at once", await page.locator("h1").isVisible());
    await shot(page, "reduced-hero");
    check("reduced motion: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} catch (e) {
  console.log(`SCRIPT ERROR: ${e?.stack ?? e}`);
  failures++;
} finally {
  await browser.close();
  server.close();
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
