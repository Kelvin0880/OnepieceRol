import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const shotsDir = path.resolve(process.cwd(), "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));

const mapPath = "file:///" + path.resolve("docs/mapa.html").replace(/\\/g, "/");
await page.goto(mapPath);
await page.waitForSelector("#routeMap circle.ring");
await page.screenshot({ path: path.join(shotsDir, "docs-map-initial.png"), fullPage: true });

// Click a different island (Isla Cementerio, far right top) to verify interactivity.
const nodes = await page.locator("#routeMap .node").all();
console.log("node count:", nodes.length);
await nodes[nodes.length - 2].click();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(shotsDir, "docs-map-selected.png"), fullPage: true });

const detailText = await page.locator("#detailCard").innerText();
console.log("detail panel after click:\n", detailText.slice(0, 300));

const indexPath = "file:///" + path.resolve("docs/index.html").replace(/\\/g, "/");
await page.goto(indexPath);
await page.screenshot({ path: path.join(shotsDir, "docs-index.png"), fullPage: true });

const guiaPath = "file:///" + path.resolve("docs/guia.html").replace(/\\/g, "/");
await page.goto(guiaPath);
await page.waitForSelector("text=GRAND LINE RPG");
await page.screenshot({ path: path.join(shotsDir, "docs-guia-top.png"), fullPage: false });

console.log("console/page errors:", errors.length ? errors : "none");
await browser.close();
