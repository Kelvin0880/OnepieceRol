import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://localhost:3000");
await page.click('button:has-text("Crear cuenta")');
await page.fill('input[placeholder="Nombre de usuario"]', "mdl" + (Date.now() % 1000000));
await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
await page.click('form button:has-text("Crear cuenta")');
await page.waitForSelector("text=Tus personajes", { timeout: 10000 });
await page.click('a:has-text("Nuevo personaje")');
await page.waitForSelector("text=Comienza tu leyenda");
await page.fill('input[placeholder*="Roronoa"]', "ModalTester");
await page.click('button:has-text("Pirata")');
await page.click('button:has-text("Espadachín")');
await page.click('button:has-text("Zarpar")');
await page.waitForSelector("text=Escena", { timeout: 10000 });

await page.click('button:has-text("Mapa y Guía")');
await page.waitForSelector("text=Abrir mapa de ruta");
await page.screenshot({ path: path.join(shotsDir, "guide-modal.png"), fullPage: true });

const mapHref = await page.locator('a:has-text("Abrir mapa de ruta")').getAttribute("href");
const guiaHref = await page.locator('a:has-text("Abrir guía del jugador")').getAttribute("href");
console.log("map href:", mapHref);
console.log("guia href:", guiaHref);
console.log("console/page errors:", errors.length ? errors : "none");

await browser.close();
