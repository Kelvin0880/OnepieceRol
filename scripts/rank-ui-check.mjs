// Real-browser check (2026-09-24): the rank shows a coherent title and a progress bar toward the next rank,
// on the character list and on the sheet, for a pirate with a small bounty (never "Sin recompensa" while
// having one) and for a marine. Needs `npm run dev`. Usage: node scripts/rank-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond) => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
};

async function player(tag, faction, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', `${tag}_${Date.now() % 100000000}`);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click(`button:has-text("${faction}")`);
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="missions-panel"]', { timeout: 30000 });
  return { ctx, page, errors };
}

try {
  const s = Date.now() % 100000;
  // ---- pirate with ฿1,050 (the reported case)
  const pirate = await player("rkp", "Pirata", `Kiritop${s}`);
  execSync(`npx tsx scripts/set-reputation.ts "Kiritop${s}" 1050 0`, { stdio: "pipe" });
  await pirate.page.reload();
  await pirate.page.waitForSelector('[data-testid="rank-progress"]');
  const sheet = await pirate.page.textContent('[data-testid="rank-progress"]');
  check("a pirate with a small bounty is NOT shown as 'Sin recompensa'", !sheet.includes("Sin recompensa") && sheet.includes("Aún sin cartel oficial"));
  check("the sheet names the next rank and how much is missing", sheet.includes("Novato de la Grand Line") && sheet.includes("faltan 998.950"));
  check("the sheet says the promotion is automatic", sheet.includes("automático"));
  const w = await pirate.page.evaluate(() => document.querySelector('[data-testid="rank-progress"] .h-full').style.width);
  check(`the bar shows a sliver of progress (${w}), not empty`, parseFloat(w) > 0 && parseFloat(w) < 10);
  await pirate.page.screenshot({ path: path.join(shots, "rank-01-sheet.png"), fullPage: true });
  await pirate.page.goto("http://localhost:3000/");
  await pirate.page.waitForSelector('[data-testid="rank-title"]');
  const listTitle = await pirate.page.textContent('[data-testid="rank-title"]');
  check("the character list shows the same coherent title", listTitle.includes("Aún sin cartel oficial"));
  check("the character list shows the next rank", (await pirate.page.textContent("body")).includes("→ Novato de la Grand Line"));
  await pirate.page.screenshot({ path: path.join(shots, "rank-02-list.png") });

  // ---- promotion: crossing the threshold changes the title
  execSync(`npx tsx scripts/set-reputation.ts "Kiritop${s}" 12000000 0`, { stdio: "pipe" });
  await pirate.page.goto(pirate.page.url().includes("/play/") ? pirate.page.url() : "http://localhost:3000/");
  await pirate.page.click(`text=Kiritop${s}`).catch(() => {});
  await pirate.page.waitForSelector('[data-testid="rank-progress"]');
  const promoted = await pirate.page.textContent('[data-testid="rank-progress"]');
  check("after crossing 10,000,000 the title is 'Pirata de interés' and the next rank is Superrookie", promoted.includes("Pirata de interés") && promoted.includes("Superrookie"));

  // ---- marine (merit)
  const marine = await player("rkm", "Marine", `Cadete${s}`);
  execSync(`npx tsx scripts/set-reputation.ts "Cadete${s}" 0 120`, { stdio: "pipe" });
  await marine.page.reload();
  await marine.page.waitForSelector('[data-testid="rank-progress"]');
  const mt = await marine.page.textContent('[data-testid="rank-progress"]');
  check("a marine sees merit progress toward the next rank", mt.includes("Marine Raso") && mt.includes("Cabo") && mt.includes("faltan 30") && mt.includes("Mérito"));
  await marine.page.screenshot({ path: path.join(shots, "rank-03-marine.png"), fullPage: true });

  for (const [n, u] of [["pirate", pirate], ["marine", marine]]) if (u.errors.length) { console.log(n, u.errors); failures++; }
} finally {
  await browser.close();
}
console.log(failures ? `FAILED (${failures})` : "ALL PASSED");
process.exit(failures ? 1 : 0);
