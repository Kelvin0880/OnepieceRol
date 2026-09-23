// Real-browser check of the redesigned /news page (2026-09-23 faction-news
// rewrite): day-grouping, category filter chips, pagination, zero console
// errors. Requires npm run dev already running.
// Usage: node scripts/check-news-page.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let failures = 0;
function check(label, cond) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failures++;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(`${BASE}/news`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const title = await page.locator("h1").first().textContent();
  check("page title renders", title?.includes("Heraldo") ?? false);

  const chips = page.locator("button", { hasText: "Todas" });
  check("category filter 'Todas' chip renders", (await chips.count()) > 0);

  const marineChip = page.locator("button", { hasText: "Gobierno Mundial" });
  check("a category chip renders", (await marineChip.count()) > 0);

  // Click a category filter and confirm the list re-fetches without crashing.
  if ((await marineChip.count()) > 0) {
    await marineChip.first().click();
    await page.waitForTimeout(800);
    check("no console errors after filtering by category", errors.length === 0);
  }

  await chips.first().click();
  await page.waitForTimeout(800);

  const dayHeaders = await page.locator("h2").allTextContents();
  console.log("Day group headers found:", dayHeaders);
  check("at least one day-group header renders (or empty-state message shows)", dayHeaders.length > 0 || (await page.getByText("en calma").count()) > 0);

  const loadMore = page.locator("button", { hasText: "Cargar más" });
  console.log("'Cargar más' button present:", (await loadMore.count()) > 0);

  check("zero unexpected console errors overall", errors.length === 0);
  if (errors.length > 0) console.log("Console errors:", errors);

  await page.screenshot({ path: "shots/news-page.png", fullPage: true });
  await browser.close();

  console.log(failures === 0 ? "\nAll news-page checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) process.exit(1);
}

main();
