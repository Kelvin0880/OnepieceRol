// Serves docs/ under /OnepieceRol/ exactly like GitHub Pages does, for browser checks of the landing.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../docs/", import.meta.url));
const BASE = "/OnepieceRol/";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

export function serveDocs(port = 4600) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(302, { location: BASE });
      return res.end();
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || "index.html";
    if (rel.endsWith("/")) rel += "index.html";
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404");
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, url: `http://localhost:${port}${BASE}` })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { url } = await serveDocs(Number(process.env.PORT ?? 4600));
  console.log(`docs served at ${url}`);
}
