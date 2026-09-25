// Real-browser check (2026-09-25) of the "Poder" panel on a phone and on a desktop: the Yonko requirement list and
// the throne list with Shanks where he really is, applying for (and resigning) the Shichibukai licence, and a
// challenge that turns into a group fight against Shanks on the play screen. Also: a CP-0 recruit lands on Tequila
// Wolf and the news/codex pages lead back to the character. Needs `npm run dev` (REFEREE_STUB/JUDGE_STUB fine).
// Usage: node scripts/sovereignty-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label} ${extra}`);
  if (!cond) failures++;
};
const browser = await chromium.launch();

async function newPlayer(width, faction, name) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `sovui_${Date.now() % 1e8}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click(`button:has-text("${faction}")`);
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="xp-bar"]', { timeout: 30000 });
  return { ctx, page, errors };
}
const fits = async (page, width, label) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${label} fits ${width}px`, sw <= width + 1, `(scrollWidth ${sw})`);
};

try {
  // ---------- CP-0 start (phone)
  const cp = await newPlayer(390, "CP-0", `Agente${Date.now() % 100000}`);
  check("a CP-0 recruit starts on Tequila Wolf", (await cp.page.textContent('[data-testid="island-card"]')).includes("Tequila Wolf"));
  await cp.page.screenshot({ path: path.join(shots, "sov-01-cp0-tequila-wolf-390.png"), fullPage: true });
  await cp.page.click('[data-testid="power-open"]');
  await cp.page.waitForSelector('[data-testid="sov-war"]');
  check("a CP-0 agent only sees the war tab (no Yonko/Shichibukai)", (await cp.page.locator('[data-testid="sov-tab-yonko"]').count()) === 0);
  await cp.ctx.close();

  for (const width of [390, 1280]) {
    const name = `Aspirante${width}${Date.now() % 10000}`;
    const p = await newPlayer(width, "Pirata", name);
    execSync(`npx tsx scripts/sovereignty-setup.ts "${name}"`, { stdio: "ignore" });
    await p.page.reload();
    await p.page.waitForSelector('[data-testid="power-open"]');
    await p.page.click('[data-testid="power-open"]');
    await p.page.waitForSelector('[data-testid="sov-yonko"]');
    const reqs = await p.page.textContent('[data-testid="requirements"]');
    check(`${width}: the Yonko requirements are listed`, reqs.includes("Nivel 35") && reqs.includes("Dominar 1 isla"));
    const throne = p.page.locator('[data-testid="sov-throne"]', { hasText: "Shanks" });
    check(`${width}: Shanks is listed as a throne you can challenge here`, (await throne.textContent()).includes("Desafiar aquí"));
    await p.page.screenshot({ path: path.join(shots, `sov-02-yonko-${width}.png`) });
    await fits(p.page, width, "power panel");

    // Shichibukai
    await p.page.click('[data-testid="sov-tab-warlord"]');
    await p.page.click('[data-testid="sov-apply"]');
    await p.page.waitForSelector("text=Eres un Shichibukai", { timeout: 15000 }).catch(() => {});
    check(`${width}: the licence is granted`, (await p.page.textContent('[data-testid="sov-warlord"]')).includes("Eres un Shichibukai"));
    await p.page.screenshot({ path: path.join(shots, `sov-03-warlord-${width}.png`) });
    await p.page.click('[data-testid="sov-tab-yonko"]');
    check(`${width}: a Shichibukai is told to resign before aiming for a throne`, (await p.page.textContent('[data-testid="requirements"]')).includes("renunciar"));
    await p.page.click('[data-testid="sov-tab-warlord"]');
    await p.page.click('button:has-text("Romper la patente")');
    await p.page.click('[data-testid="sov-resign"]');
    await p.page.waitForSelector('[data-testid="sov-apply"]');
    check(`${width}: resigning returns to the application form`, true);

    // The challenge
    await p.page.click('[data-testid="sov-tab-yonko"]');
    // The resignation just raised the bounty and made the Government remember: the throne path is still open.
    await p.page.click('[data-testid="sov-fate-capture"]');
    await p.page.locator('[data-testid="sov-throne"]', { hasText: "Shanks" }).locator('[data-testid="sov-challenge"]').click();
    await p.page.waitForSelector('[data-testid="sov-notice"]', { timeout: 30000 });
    await p.page.keyboard.press("Escape");
    await p.page.waitForSelector("text=Pelea en grupo contra Shanks", { timeout: 20000 });
    check(`${width}: the challenge opens a group fight against Shanks on the play screen`, true);
    await p.page.waitForTimeout(600);
    await p.page.screenshot({ path: path.join(shots, `sov-04-challenge-${width}.png`), fullPage: true });
    await fits(p.page, width, "play screen during the challenge");

    // News and codex lead back to the character
    await p.page.goto(`${BASE}/news`);
    await p.page.waitForSelector("text=El Heraldo del Mundo");
    await p.page.waitForSelector("text=desafía a Shanks", { timeout: 20000 }).catch(() => {});
    check(`${width}: the news show the challenge`, (await p.page.textContent("body")).includes("desafía a Shanks"));
    check(`${width}: the news page has a way back to the character`, (await p.page.textContent('[data-testid="back-to-character"]')).includes(name));
    await p.page.screenshot({ path: path.join(shots, `sov-05-news-${width}.png`) });
    await p.page.click('[data-testid="back-to-character"]');
    await p.page.waitForSelector('[data-testid="xp-bar"]');
    check(`${width}: the back button returns to the play screen`, p.page.url().includes("/play/"));
    check(`${width}: no page errors`, p.errors.length === 0, p.errors.join(" | "));
    await p.ctx.close();
  }
} catch (e) {
  failures++;
  console.log("FAIL: script crashed", e.message);
} finally {
  await browser.close();
  console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
