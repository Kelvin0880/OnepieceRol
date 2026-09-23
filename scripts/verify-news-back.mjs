// Ad-hoc verification for the "Volver" news-page navigation bug fix
// (was Link href="/", now router.back()). Requires npm run dev running.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const username = "newsnav" + (Date.now() % 100000);

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(BASE);
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('input[placeholder="Nombre de usuario"]', username);
  await page.fill('input[placeholder="Contraseña"]', "clavesegura123");
  await page.click('form button:has-text("Crear cuenta")');
  await page.waitForSelector("text=Tus personajes", { timeout: 10000 });

  await page.click('a:has-text("Nuevo personaje")');
  await page.waitForSelector("text=Comienza tu leyenda");
  await page.fill('input[placeholder*="Roronoa"]', "NewsNavTester");
  await page.click('button:has-text("Pirata")');
  await page.click('button:has-text("Espadachín")');
  await page.click('button:has-text("Zarpar")');
  await page.waitForSelector("text=Bitácora", { timeout: 10000 });
  const playUrl = page.url();
  console.log("On play page:", playUrl);

  await page.click('a:has-text("Noticias")');
  await page.waitForSelector("text=El Heraldo del Mundo");
  console.log("On news page:", page.url());

  await page.click('button:has-text("Volver")');
  await page.waitForTimeout(500);
  const backUrl = page.url();
  console.log("After Volver:", backUrl);

  console.log(backUrl === playUrl ? "PASS: returned to the same character's play page" : "FAIL: did not return to the play page");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
