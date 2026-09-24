// Real-browser check (2026-09-24): out-of-role panel, XP bar, restore points, crew panel with invitations
// between two accounts, and live crewmate cards. Needs `npm run dev` + an OpenRouter key for the chat reply.
// Usage: node scripts/ooc-crew-ui-check.mjs
import { chromium } from "playwright";
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

async function player(tag, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
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
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="missions-panel"]', { timeout: 30000 });
  return { ctx, page, errors };
}

try {
  const stamp = Date.now() % 10000;
  const A = await player("ooca", `Kirito${stamp}`);
  const B = await player("oocb", `Asuna${stamp}`);
  const pa = A.page;

  // --- XP bar + 100 base HP
  check("XP bar is visible", await pa.locator('[data-testid="xp-bar"]').isVisible());
  check("base HP is 100", (await pa.textContent("body")).includes("100/100"));
  await pa.screenshot({ path: path.join(shots, "ooc-01-sheet.png"), fullPage: true });

  // --- Out-of-role panel
  await pa.click('[data-testid="ooc-open"]');
  await pa.waitForSelector('[data-testid="ooc-panel"]');
  await pa.fill('[data-testid="ooc-input"]', "Hola, ¿cómo subo de nivel?");
  await pa.click('[data-testid="ooc-send"]');
  await pa.waitForFunction(() => {
    const el = document.querySelector('[data-testid="ooc-chat"]');
    return el && !el.textContent.includes("pensando") && el.querySelectorAll(":scope > div").length >= 2;
  }, null, { timeout: 90000 });
  const chatText = await pa.textContent('[data-testid="ooc-chat"]');
  console.log("assistant said:", chatText.slice(0, 300));
  check("the out-of-role assistant answers a how-to question", chatText.length > 90 && !chatText.includes("no respondió"));
  await pa.screenshot({ path: path.join(shots, "ooc-02-chat.png") });

  await pa.click('button:has-text("Herramientas")');
  await pa.click('[data-testid="ooc-tone-story"]');
  await pa.waitForSelector('[data-testid="ooc-notice"]:has-text("historia")');
  check("narrator tone can be changed", true);
  await pa.fill('[data-testid="ooc-note-input"]', "No repitas mi acción");
  await pa.click('[data-testid="ooc-note-add"]');
  await pa.waitForSelector('[data-testid="ooc-notes"]:has-text("No repitas")');
  check("standing note is saved and shown", true);
  await pa.fill('[data-testid="ooc-name"]', `Kirito Negro${stamp}`);
  await pa.click('button:has-text("Renombrar")');
  await pa.waitForSelector('[data-testid="ooc-notice"]:has-text("Ahora tu personaje se llama")');
  check("the character can be renamed", true);
  await pa.click('[data-testid="ooc-undo"]');
  await pa.waitForSelector('[data-testid="ooc-error"]');
  check("undo with nothing to undo says so instead of failing", (await pa.textContent('[data-testid="ooc-error"]')).toLowerCase().includes("no hay"));
  await pa.fill('[data-testid="ooc-report-input"]', "Prueba de reporte automática");
  await pa.click('[data-testid="ooc-report-send"]');
  await pa.waitForSelector('[data-testid="ooc-notice"]:has-text("Reporte enviado")');
  check("a problem report can be filed", true);
  await pa.click('button:has-text("Reparar valores")');
  await pa.waitForSelector('[data-testid="ooc-notice"]:has-text("orden")');
  check("repair reports a healthy state", true);

  await pa.click('button:has-text("Puntos de restauración")');
  await pa.waitForSelector('[data-testid="ooc-points"]');
  check("the starting restore point exists", (await pa.locator('[data-testid="ooc-points"] >> text=Inicio de tu leyenda').count()) > 0);
  await pa.fill('[data-testid="ooc-point-input"]', "Antes de entrenar");
  await pa.click('[data-testid="ooc-point-save"]');
  await pa.waitForSelector('[data-testid="ooc-points"] >> text=Antes de entrenar');
  check("a manual restore point can be saved", true);
  await pa.screenshot({ path: path.join(shots, "ooc-03-points.png") });
  await pa.click('button:has-text("Volver al rol")');

  // train, then roll back to the manual point and see the state return
  await pa.click('button:has-text("Entrenar")');
  await pa.waitForTimeout(2500);
  await pa.click('[data-testid="ooc-open"]');
  await pa.click('button:has-text("Puntos de restauración")');
  const row = pa.locator('[data-testid="ooc-points"] > div', { hasText: "Antes de entrenar" });
  await row.locator('[data-testid="ooc-rollback"]').click();
  await pa.click('[data-testid="ooc-rollback-confirm"]');
  await pa.waitForSelector('[data-testid="ooc-notice"]:has-text("Volviste")');
  check("rollback to a restore point works and reports it", true);
  await pa.waitForFunction(() => document.querySelector('[data-testid="ooc-rollbacks-left"]')?.textContent?.trim() === "2", null, { timeout: 10000 }).catch(() => {});
  check("rollbacks left counter drops", (await pa.textContent('[data-testid="ooc-rollbacks-left"]')).trim() === "2");
  await pa.click('button:has-text("Volver al rol")');

  // --- Crew panel with invitations
  await pa.click('[data-testid="crew-open"]');
  await pa.waitForSelector('[data-testid="crew-panel"]');
  await pa.click('[data-testid="crew-tab-invite"]');
  await pa.fill('[data-testid="new-crew-name"]', `Black Bulls ${stamp}`);
  await pa.click('[data-testid="new-crew-go"]');
  await pa.click('[data-testid="crew-tab-crew"]');
  await pa.waitForSelector('[data-testid="crew-members"]');
  check("the crew is founded from the panel", (await pa.locator('[data-testid="crew-member"]').count()) === 1);

  await pa.click('[data-testid="crew-tab-invite"]');
  await pa.waitForSelector('[data-testid="invite-section"]');
  await pa.waitForSelector(`[data-testid="candidates"] >> text=Asuna${stamp}`);
  check("a same-island crewless player shows up as a candidate", true);
  await pa.locator('[data-testid="candidates"] > div', { hasText: `Asuna${stamp}` }).locator('[data-testid="candidate-invite"]').click();
  await pa.waitForSelector('[data-testid="crew-notice"]:has-text("Invitación enviada")');
  check("an invitation can be sent", true);
  await pa.screenshot({ path: path.join(shots, "crew-01-invite.png") });

  const pb = B.page;
  await pb.reload();
  await pb.waitForSelector('[data-testid="crew-open"]');
  await pb.waitForFunction(() => document.querySelector('[data-testid="crew-open"]')?.textContent?.match(/\d/), null, { timeout: 30000 });
  check("the invited player sees a badge with the pending invitation", true);
  await pb.click('[data-testid="crew-open"]');
  await pb.click('[data-testid="crew-tab-invite"]');
  await pb.waitForSelector('[data-testid="invites-received"] >> text=Black Bulls');
  await pb.screenshot({ path: path.join(shots, "crew-02-received.png") });
  await pb.click('[data-testid="invite-accept"]');
  await pb.waitForSelector('[data-testid="crew-tab-crew"]');
  await pb.click('[data-testid="crew-tab-crew"]');
  await pb.waitForFunction(() => document.querySelectorAll('[data-testid="crew-member"]').length === 2, null, { timeout: 15000 });
  check("accepting the invitation joins the crew (2 member cards)", true);
  const cards = await pb.locator('[data-testid="crew-member"]').allTextContents();
  check("member cards show HP and stamina", cards.every((t) => t.includes("Vida") && t.includes("Aguante")));
  check("member cards show Haki / fruit / weapon info", cards.every((t) => t.includes("Arma:")));
  await pb.screenshot({ path: path.join(shots, "crew-03-members.png"), fullPage: true });

  await pa.reload();
  await pa.click('[data-testid="crew-open"]');
  await pa.waitForFunction(() => document.querySelectorAll('[data-testid="crew-member"]').length === 2, null, { timeout: 20000 });
  check("the captain sees the new member too", true);

  for (const [n, u] of [["A", A], ["B", B]]) {
    if (u.errors.length) {
      console.log(`page errors ${n}:`, u.errors);
      failures++;
    }
  }
} finally {
  await browser.close();
}
console.log(failures ? `FAILED (${failures})` : "ALL PASSED");
process.exit(failures ? 1 : 0);
