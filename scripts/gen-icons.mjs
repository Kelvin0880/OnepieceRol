// Regenerates every raster icon from the one source of truth, src/app/icon.svg:
//   src/app/favicon.ico (16/32/48, PNG-in-ICO), src/app/apple-icon.png (180),
//   public/icons/icon-192.png, icon-512.png and icon-maskable-512.png (Android home screen, with safe padding).
// Usage: node scripts/gen-icons.mjs   (needs the Playwright browser, not the dev server)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const root = process.cwd();
const svg = fs.readFileSync(path.join(root, "src/app/icon.svg"), "utf8");
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(size, { padding = 0, background = "transparent" } = {}) {
  const inner = size - padding * 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${background};width:${size}px;height:${size}px;display:grid;place-items:center">` +
      `<img src="${svgUrl}" width="${inner}" height="${inner}"></body></html>`
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  return page.screenshot({ omitBackground: background === "transparent", clip: { x: 0, y: 0, width: size, height: size } });
}

// ICO container holding PNG images (supported by every current browser and Windows Vista+).
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const icoPngs = [];
for (const size of [16, 32, 48]) icoPngs.push({ size, data: await render(size) });
fs.writeFileSync(path.join(root, "src/app/favicon.ico"), ico(icoPngs));

fs.writeFileSync(path.join(root, "src/app/apple-icon.png"), await render(180, { padding: 14, background: "#0b1520" }));

const out = path.join(root, "public/icons");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "icon-192.png"), await render(192));
fs.writeFileSync(path.join(out, "icon-512.png"), await render(512));
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), await render(512, { padding: 64, background: "#0b1520" }));

await browser.close();
console.log("icons written: src/app/favicon.ico, src/app/apple-icon.png, public/icons/*.png");
