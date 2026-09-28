// Renders the landing's hero as the 1200x630 share image (WhatsApp/Discord/Twitter previews) into landing/public/og.jpg.
// Build the landing first, run this, then build again so the image is copied into docs/.
import { chromium } from "playwright";
import { serveDocs } from "./lib/serve-docs.mjs";

const { server, url } = await serveDocs(4604);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  // ignoreHTTPSErrors: in sandboxes the TLS proxy is not trusted by Chromium and the Google Fonts would not load.
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await page.goto(`${url}?og=1&voyage=0&tier=high&capture=1`, { waitUntil: "load" });
  await page.waitForSelector('[data-ready="true"]', { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "landing/public/og.jpg", type: "jpeg", quality: 86 });
  console.log("wrote landing/public/og.jpg");
} finally {
  await browser.close();
  server.close();
}
