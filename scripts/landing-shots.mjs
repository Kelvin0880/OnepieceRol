// Quick visual pass over the landing's 3D voyage: one screenshot per sea at a desktop and a phone size.
// Usage: node scripts/landing-shots.mjs [voyage values, comma separated] [tier] [extra query]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serveDocs } from "./lib/serve-docs.mjs";

const values = (process.argv[2] ?? "0,1,2,3,4").split(",");
const tier = process.argv[3] ?? "high";
const extra = process.argv[4] ? `&${process.argv[4]}` : "";
mkdirSync("shots/landing", { recursive: true });
const { server, url } = await serveDocs(4601);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", ...(process.env.EXTRA_ARGS ? process.env.EXTRA_ARGS.split(" ") : [])],
});
try {
  for (const [label, viewport] of [
    ["desk", { width: 1280, height: 800 }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    if (process.env.ONLY && process.env.ONLY !== label) continue;
    for (const v of values) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => {
        if (process.env.DEBUG) console.log(`  [${label} ${m.type()}] ${m.text().slice(0, 300)}`);
        else if (m.type() === "error" && !m.text().includes("ERR_CERT")) errors.push(m.text());
      });
      await page.goto(`${url}?voyage=${v}&tier=${tier}&capture=1${extra}`, { waitUntil: "load" });
      await page.waitForSelector('[data-ready="true"]', { timeout: 60000 });
      await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
      const path = `shots/landing/voyage-${v}-${label}.png`;
      if (process.env.DEBUG) {
        const state = await page.evaluate(() => {
          const c = document.querySelector("[data-scene] canvas");
          const gl = c?.getContext("webgl2") ?? c?.getContext("webgl");
          const wrap = c?.closest("[style]");
          return { canvases: document.querySelectorAll("canvas").length, w: c?.width, h: c?.height, lost: gl?.isContextLost(), opacity: wrap ? getComputedStyle(wrap).opacity : null, tier: document.querySelector("[data-tier]")?.getAttribute("data-tier") };
        });
        console.log("  state", JSON.stringify(state));
      }
      await page.screenshot({ path });
      console.log(path, errors.length ? `errors: ${errors.join(" | ")}` : "");
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
