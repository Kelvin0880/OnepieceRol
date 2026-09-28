// Walks the whole landing section by section and screenshots each one, at desktop and phone sizes.
// Usage: node scripts/landing-page-shots.mjs [tier]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serveDocs } from "./lib/serve-docs.mjs";

const tier = process.argv[2] ?? "high";
const SECTIONS = ["top", "juego", "mundo", "viaje", "reverse-mountain", "paradise", "cartel", "nuevo-mundo", "frutas", "sistemas", "zarpa"];
mkdirSync("shots/landing/page", { recursive: true });
const { server, url } = await serveDocs(4603);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  for (const [label, viewport, opts] of [
    ["desk", { width: 1280, height: 800 }, {}],
    ["phone", { width: 390, height: 844 }, { isMobile: true, hasTouch: true }],
  ]) {
    if (process.env.ONLY && process.env.ONLY !== label) continue;
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, ignoreHTTPSErrors: true, ...opts });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !m.text().includes("ERR_CERT") && errors.push(m.text()));
    await page.goto(`${url}?tier=${tier}&nosmooth=1&nointro=1&capture=1`, { waitUntil: "load" });
    await page.waitForSelector('[data-ready="true"]', { timeout: 60000 }).catch(() => console.log("3D not ready"));
    for (const id of process.env.SECTIONS ? process.env.SECTIONS.split(",") : SECTIONS) {
      await page.evaluate((sid) => (sid === "bottom" ? window.scrollTo(0, document.documentElement.scrollHeight) : document.getElementById(sid)?.scrollIntoView({ block: "start" })), id);
      await page.waitForTimeout(Number(process.env.WAIT ?? 3200));
      const path = `shots/landing/page/${label}-${id}.png`;
      await page.screenshot({ path });
      console.log(path);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(`${label}: scrollWidth=${overflow} (viewport ${viewport.width})`);
    if (errors.length) console.log(`${label} errors:\n  ${errors.join("\n  ")}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
