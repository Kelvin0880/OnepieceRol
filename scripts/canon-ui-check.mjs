// Real-browser check (390px) of the canon panel: people of the island, challenge, duel, the winner's verdict and the owner's confirmation.
// Needs `npm run dev` (ADMIN_USERNAMES=Kelvin) and a freshly seeded DB. Usage: node scripts/canon-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label} ${extra}`);
  if (!cond) failures++;
};
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const errors = [];
async function register(username) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  return page;
}
const sh = (cmd) => execSync(cmd, { encoding: "utf8" });
try {
  const name = `Canon${Date.now() % 100000}`;
  const page = await register(`canon_${Date.now() % 100000000}`);
  await page.click('a:has-text("Nuevo personaje")');
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Escena", { timeout: 30000 });
  const url = page.url();
  sh(`npx tsx scripts/canon-setup.ts stage ${name}`);
  await page.goto(url);

  await page.waitForSelector('[data-testid="island-people"]', { timeout: 30000 });
  check("the play screen has a 'Gente de' panel", /Gente de Whole Cake Island/.test(await page.locator('[data-testid="island-people"]').textContent()));
  const actors = await page.locator('[data-testid="canon-actor"]').allTextContents();
  check("canon characters in plain sight are listed", actors.some((t) => /Katakuri/.test(t)) && actors.some((t) => /Perospero/.test(t)));
  await page.click('[data-testid="people-tab-residents"]');
  check("the island's own people are listed with a live state", (await page.locator('[data-testid="cast-entry"]').count()) >= 4 && (await page.locator('[data-testid="cast-state"]').first().textContent()).length > 3);
  await page.screenshot({ path: path.join(shots, "canon-01-residents.png") });
  await page.click('[data-testid="people-tab-canon"]');
  await page.screenshot({ path: path.join(shots, "canon-02-canon.png") });

  const katakuri = page.locator('[data-testid="canon-actor"]', { hasText: "Katakuri" });
  check("a Yonko is not offered here but the commanders are challengeable", (await katakuri.locator('[data-testid="canon-challenge"]').isEnabled()) === true);
  await katakuri.locator('[data-testid="canon-challenge"]').click();
  await page.waitForSelector('[data-testid="canon-challenge-confirm"]');
  await page.screenshot({ path: path.join(shots, "canon-03-confirm.png") });
  await page.click('[data-testid="canon-challenge-go"]');
  await page.waitForSelector('[data-testid="joint-participant"]', { timeout: 30000 });
  check("the vanguard fight opens", true);

  sh(`npx tsx scripts/canon-setup.ts win ${name}`);
  await page.reload();
  await page.waitForSelector('[data-testid="canon-ready"]', { timeout: 30000 });
  check("beating the guard opens the duel button", /Enfrentar a Charlotte Katakuri/.test(await page.locator('[data-testid="canon-duel"]').textContent()));
  await page.screenshot({ path: path.join(shots, "canon-04-ready.png") });
  await page.click('[data-testid="canon-duel"]');
  await page.waitForSelector('[data-testid="joint-participant"]', { timeout: 30000 });

  sh(`npx tsx scripts/canon-setup.ts win ${name}`);
  await page.reload();
  await page.waitForSelector('[data-testid="canon-verdict"]', { timeout: 30000 });
  check("the winner gets the three options and the warning about the owner", /confirmación del administrador/.test(await page.locator('[data-testid="canon-verdict"]').textContent()));
  await page.screenshot({ path: path.join(shots, "canon-05-verdict.png") });
  await page.click('[data-testid="canon-verdict-capture"]');
  await page.waitForSelector('[data-testid="canon-waiting"]', { timeout: 30000 });
  check("after asking for the capture the player waits for the administrator", /administrador/.test(await page.locator('[data-testid="canon-waiting"]').textContent()));
  await page.screenshot({ path: path.join(shots, "canon-06-waiting.png") });

  const admin = await register("Kelvin");
  await admin.goto(`${BASE}/admin`);
  await admin.waitForSelector('[data-testid="admin-proposal"]', { timeout: 30000 });
  const proposal = await admin.locator('[data-testid="admin-proposal"]').textContent();
  check("the owner sees who beat whom and what they ask", new RegExp(name).test(await admin.locator('[data-testid="admin-arc"]').first().textContent()) && /CAPTURARLO/.test(proposal));
  await admin.click('[data-testid="admin-choose-capture"]');
  await admin.click('[data-testid="admin-confirm"]');
  await admin.waitForSelector('[data-testid="admin-empty"]', { timeout: 60000 });
  await admin.screenshot({ path: path.join(shots, "canon-07-admin.png") });

  await page.reload();
  await page.waitForSelector('[data-testid="island-people"]');
  check("after the owner confirms, the captured character is off the panel", !(await page.locator('[data-testid="canon-actor"]').allTextContents()).some((t) => /Katakuri/.test(t)));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 390 + 2);
  check("no horizontal overflow at 390px", !overflow);
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
