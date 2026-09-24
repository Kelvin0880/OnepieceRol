// Real-browser check (2026-09-24) of the world features: news with locations + the "Eventos mundiales" section,
// the owner-only admin page with the verdict flow, the codex, the intervention panel, the crew flag upload and
// the bounty-hunter solo rule. Needs `npm run dev` (with ADMIN_USERNAMES=Kelvin in .env) and a freshly seeded DB.
// Usage: node scripts/world-ui-check.mjs
import { chromium } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import zlib from "zlib";

const shots = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const check = (label, cond) => {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
};
const sh = (cmd) => execSync(cmd, { cwd: process.cwd(), stdio: "pipe" }).toString();

/** A real 96x96 PNG made on the fly (no fixture files needed). */
function makePng() {
  const w = 96, h = 96;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = x * 2; raw[o + 1] = y * 2; raw[o + 2] = 160;
    }
  }
  const crc = (buf) => {
    let c, crcv = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crcv ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcv = (crcv >>> 8) ^ c;
    }
    return (crcv ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function register(username, password = "clavesegura123") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', password);
  await page.click('form button:has-text("Crear cuenta")');
  return { ctx, page, errors };
}

async function makeCharacter(page, name, faction, archetype = "Espadachín") {
  await page.waitForSelector("text=Tus personajes");
  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', name);
  await page.click(`button:has-text("${faction}")`);
  await page.click(`button:has-text("${archetype}")`);
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector('[data-testid="missions-panel"]', { timeout: 30000 });
}

try {
  const stamp = Date.now() % 100000;

  // ---------- the lookalike of the owner's name is refused
  const look = await register("kelvin");
  await look.page.waitForTimeout(1500);
  check("a name that only differs from the owner's by case is refused at signup", (await look.page.textContent("body")).includes("reservado"));
  await look.ctx.close();

  // ---------- the owner (exact name) and a regular player
  sh("npx tsx scripts/force-world-arc.ts awaiting");
  const owner = await register("Kelvin", "pruebaLocal123");
  await owner.page.waitForSelector("text=Tus personajes", { timeout: 15000 }).catch(() => {});
  const ownerCreated = (await owner.page.textContent("body")).includes("Tus personajes");
  check("the owner account (exact name) can register", ownerCreated);

  // the owner is told, on the play screen itself, that a verdict is waiting
  await makeCharacter(owner.page, `Dueno${stamp}`, "Pirata");
  await owner.page.waitForSelector('[data-testid="admin-header-link"]');
  check("the owner sees an Administración link with a badge when a verdict is pending", (await owner.page.textContent('[data-testid="admin-header-link"]')).match(/\d/) !== null);

  // news page: world events section, chapter cards with a location pin, admin link
  await owner.page.goto("http://localhost:3000/news");
  await owner.page.waitForSelector('[data-testid="world-events"]');
  const beats = await owner.page.locator('[data-testid="world-event-beat"]').count();
  check(`the news page shows a dedicated "Eventos mundiales" section with the chapters (${beats})`, beats === 6);
  check("the event shows it is waiting for a decision", (await owner.page.textContent('[data-testid="world-event-status"]')).includes("desenlace"));
  check("chapters show where they happened", (await owner.page.locator('[data-testid="world-event-beat"] [data-testid="news-location"]').count()) === 6);
  await owner.page.waitForFunction(() => document.querySelectorAll('[data-testid="news-location"]').length > 6, null, { timeout: 30000 }).catch(() => {});
  check("regular news cards also carry a location pin", (await owner.page.locator('[data-testid="news-location"]').count()) > 6);
  check("the ending (death/capture) is NOT revealed in the public section", !(await owner.page.textContent('[data-testid="world-events"]')).match(/capturad|murió|muere/i));
  check("the owner sees the Administración link", await owner.page.locator('[data-testid="admin-link"]').isVisible());
  await owner.page.screenshot({ path: path.join(shots, "world-01-news.png"), fullPage: true });

  // admin page: the proposal and the verdict
  await owner.page.click('[data-testid="admin-link"]');
  await owner.page.waitForSelector('[data-testid="admin-proposal"]');
  const proposal = await owner.page.textContent('[data-testid="admin-proposal"]');
  check("the admin page asks the owner directly", proposal.includes("¿Permites que Eustass Kid sea CAPTURADO"));
  await owner.page.screenshot({ path: path.join(shots, "world-02-admin.png"), fullPage: true });
  await owner.page.click('[data-testid="admin-deny"]');
  await owner.page.waitForSelector('[data-testid="admin-confirm"]');
  check("a verdict needs an explicit second confirmation", true);
  await owner.page.click('[data-testid="admin-confirm"]');
  await owner.page.waitForSelector('[data-testid="admin-notice"]', { timeout: 90000 });
  check("denying publishes the ending", (await owner.page.textContent('[data-testid="admin-notice"]')).includes("Desenlace publicado"));
  await owner.page.waitForSelector('[data-testid="admin-empty"]');
  check("the resolved event leaves the admin queue", true);
  await owner.page.goto("http://localhost:3000/news");
  await owner.page.waitForSelector('[data-testid="world-event-beat"]');
  check("the news now shows the ending as chapter 7", (await owner.page.locator('[data-testid="world-event-beat"]').count()) === 7);
  check("the event is marked concluded", (await owner.page.textContent('[data-testid="world-event-status"]')).includes("Concluido"));
  await owner.page.screenshot({ path: path.join(shots, "world-03-resolved.png"), fullPage: true });

  // a regular player cannot enter the admin page or the admin API
  const player = await register(`pl_${stamp}`);
  await makeCharacter(player.page, `Hero${stamp}`, "Pirata");
  await player.page.goto("http://localhost:3000/admin");
  await player.page.waitForSelector('[data-testid="admin-error"]');
  check("a regular player is refused on the admin page", (await player.page.textContent('[data-testid="admin-error"]')).includes("dueño"));
  const apiRes = await player.page.evaluate(async () => (await fetch("/api/admin/world-arcs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "decide", arcId: "x", approve: true }) })).status);
  check("the admin API answers 403 to a regular player", apiRes === 403);
  await player.page.goto("http://localhost:3000/news");
  await player.page.waitForSelector('[data-testid="world-events"]');
  check("a regular player does not see the admin link", (await player.page.locator('[data-testid="admin-link"]').count()) === 0);

  // ---------- intervention panel (level gate)
  sh(`npx tsx scripts/force-world-arc.ts siege "Hero${stamp}"`);
  await player.page.goBack();
  await player.page.goBack().catch(() => {});
  await player.page.goto("http://localhost:3000/");
  await player.page.click(`text=Hero${stamp}`).catch(() => {});
  await player.page.waitForSelector('[data-testid="world-event-panel"]', { timeout: 30000 });
  check("a character at the event's location sees the world-event panel", true);
  check("a low-level character is told the level needed", (await player.page.textContent('[data-testid="world-event-reason"]')).includes("nivel"));
  await player.page.screenshot({ path: path.join(shots, "world-04-intervene-gate.png"), fullPage: true });
  sh(`npx tsx scripts/set-level.ts "Hero${stamp}" 60`);
  await player.page.reload();
  await player.page.waitForSelector('[data-testid="intervene-defend"]', { timeout: 30000 });
  check("with enough level the three intervention choices appear", (await player.page.locator('[data-testid^="intervene-"]').count()) === 3);
  await player.page.screenshot({ path: path.join(shots, "world-05-intervene.png"), fullPage: true });

  // ---------- crew flag upload
  await player.page.click('[data-testid="crew-open"]');
  await player.page.click('[data-testid="crew-tab-invite"]');
  await player.page.fill('[data-testid="new-crew-name"]', `Banderas ${stamp}`);
  await player.page.click('[data-testid="new-crew-go"]');
  await player.page.click('[data-testid="crew-tab-crew"]');
  await player.page.waitForSelector('[data-testid="emblem-editor"]');
  const pngPath = path.join(shots, "flag-test.png");
  fs.writeFileSync(pngPath, makePng());
  await player.page.setInputFiles('[data-testid="emblem-file"]', pngPath);
  await player.page.waitForSelector('[data-testid="crew-emblem"]', { timeout: 15000 });
  await player.page.waitForFunction(() => document.querySelector('[data-testid="crew-emblem"]')?.complete && document.querySelector('[data-testid="crew-emblem"]').naturalWidth > 0, null, { timeout: 15000 }).catch(() => {});
  const w = await player.page.evaluate(() => document.querySelector('[data-testid="crew-emblem"]').naturalWidth);
  check(`the crew flag uploads, is resized and renders (${w}px)`, w > 0 && w <= 256);
  const served = await player.page.evaluate(async () => {
    const src = document.querySelector('[data-testid="crew-emblem"]').getAttribute("src");
    const r = await fetch(src);
    return { status: r.status, type: r.headers.get("content-type"), csp: r.headers.get("content-security-policy") };
  });
  check("the flag is served as an image with a locked-down policy", served.status === 200 && served.type.startsWith("image/") && served.csp.includes("sandbox"));
  await player.page.screenshot({ path: path.join(shots, "world-06-flag.png"), fullPage: true });
  await player.page.click('button:has-text("Quitar bandera")');
  await player.page.waitForSelector('[data-testid="crew-emblem"]', { state: "detached" });
  check("the flag can be removed", true);
  await player.page.click('[data-testid="crew-panel"] button:has-text("Cerrar")');

  // ---------- bounty hunters work alone
  const bh = await register(`bh_${stamp}`);
  await makeCharacter(bh.page, `Cazador${stamp}`, "Cazarrecompensas");
  await bh.page.click('[data-testid="crew-open"]');
  await bh.page.waitForSelector('[data-testid="solo-notice"]');
  check("a bounty hunter sees that they work alone (no crew tabs)", (await bh.page.locator('[data-testid="crew-tab-invite"]').count()) === 0 || !(await bh.page.locator('[data-testid="crew-tab-invite"]').isVisible()));
  await bh.page.screenshot({ path: path.join(shots, "world-07-solo.png"), fullPage: true });

  // ---------- codex
  const cx = player.page;
  await cx.goto("http://localhost:3000/codex");
  await cx.waitForSelector('[data-testid="codex-card"]');
  const cards = await cx.locator('[data-testid="codex-card"]').count();
  check(`the codex lists many active characters (${cards})`, cards > 60);
  check("cards show location pins", (await cx.locator('[data-testid="codex-location"]').count()) > 60);
  await cx.fill('[data-testid="codex-search"]', "Shanks");
  await cx.waitForFunction(() => document.querySelectorAll('[data-testid="codex-card"]').length <= 3);
  const shanks = await cx.textContent('[data-testid="codex-card"]');
  check("Shanks shows his canon bounty, abilities and stats", shanks.includes("4.048.900.000") && shanks.includes("Gryphon") && shanks.includes("Fuerza"));
  await cx.fill('[data-testid="codex-search"]', "");
  await cx.click('[data-testid="codex-history"]');
  await cx.fill('[data-testid="codex-search"]', "Newgate");
  await cx.waitForSelector('[data-testid="codex-card"]');
  check("lore-only characters live under 'historia' (Barbablanca: deceased, no location)", (await cx.textContent('[data-testid="codex-card"]')).includes("Fallecido") && (await cx.locator('[data-testid="codex-location"]').count()) === 0);
  await cx.screenshot({ path: path.join(shots, "world-08-codex.png"), fullPage: true });
  const hidden = await cx.evaluate(async () => (await (await fetch("/api/codex")).json()).actors.filter((a) => a.name === "Monkey D. Dragon")[0]);
  check("a character moving in secret never reveals a location (Dragon: Ubicación desconocida)", hidden.location === "Ubicación desconocida" && hidden.locationKind === "unknown");
  const all = await cx.evaluate(async () => (await (await fetch("/api/codex")).json()).actors.filter((a) => a.status === "ACTIVE"));
  check("every location in the codex is an island, 'En el mar, entre X y Y' or 'Ubicación desconocida'", all.every((a) => a.locationKind === "unknown" ? a.location === "Ubicación desconocida" : a.locationKind === "sea" ? a.location.startsWith("En el mar, entre ") : !!a.location));

  for (const [n, u] of [["owner", owner], ["player", player], ["bh", bh]]) {
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
