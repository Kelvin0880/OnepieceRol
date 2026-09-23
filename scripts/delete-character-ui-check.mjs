import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));

const username = "delui" + (Date.now() % 1000000);

await page.goto("http://localhost:3000");
await page.click('button:has-text("Crear cuenta")');
await page.fill('input[placeholder="Nombre de usuario"]', username);
await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
await page.click('form button:has-text("Crear cuenta")');
await page.waitForSelector("text=Tus personajes", { timeout: 10000 });

await page.click('a:has-text("Nuevo personaje")');
await page.waitForSelector("text=Comienza tu leyenda");
await page.fill('input[placeholder*="Roronoa"]', "PersonajeDesechable");
await page.click('button:has-text("Pirata")');
await page.click('button:has-text("Espadachín")');
await page.click('button:has-text("Zarpar")');
await page.waitForSelector("text=Escena", { timeout: 10000 });

await page.goto("http://localhost:3000");
await page.waitForSelector("text=PersonajeDesechable");
await page.screenshot({ path: path.join(shotsDir, "delete-1-before.png") });

const row = page.locator("div.panel", { hasText: "PersonajeDesechable" });
await row.locator('button:has-text("Borrar")').click();
await page.waitForSelector("text=¿Borrar para siempre?");
await page.screenshot({ path: path.join(shotsDir, "delete-2-confirm.png") });

await row.locator('button:has-text("Sí, borrar")').click();
await page.waitForTimeout(500);

const stillThere = await page.locator("text=PersonajeDesechable").count();
console.log("character still visible after delete:", stillThere, stillThere === 0 ? "(expected 0 = PASS)" : "(FAIL)");
await page.screenshot({ path: path.join(shotsDir, "delete-3-after.png") });

console.log("console/page errors:", errors.length ? errors : "none");
await browser.close();
