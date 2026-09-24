import { describe, it, expect } from "vitest";
import { parseEmblemDataUrl, EMBLEM_MAX_BYTES } from "./crew-emblem";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const JPG = Buffer.from("ffd8ffe000104a464946", "hex");
const GIF = Buffer.from("GIF89a\x01\x00", "binary");
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const url = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString("base64")}`;

describe("parseEmblemDataUrl", () => {
  it("accepts real PNG, JPEG, WebP and GIF images", () => {
    for (const [mime, b] of [["image/png", PNG], ["image/jpeg", JPG], ["image/webp", WEBP], ["image/gif", GIF]] as const) {
      const r = parseEmblemDataUrl(url(mime, b));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.mime).toBe(mime);
    }
  });
  it("refuses SVG (it can carry scripts) and any other type", () => {
    expect(parseEmblemDataUrl(`data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)/>").toString("base64")}`).ok).toBe(false);
    expect(parseEmblemDataUrl(`data:text/html;base64,${Buffer.from("<script>x</script>").toString("base64")}`).ok).toBe(false);
  });
  it("refuses a file whose bytes do not match its declared type", () => {
    const r = parseEmblemDataUrl(url("image/png", Buffer.from("<html>not an image</html>")));
    expect(r.ok).toBe(false);
    expect(parseEmblemDataUrl(url("image/png", JPG)).ok).toBe(false);
  });
  it("refuses oversized, empty and malformed input", () => {
    const big = Buffer.concat([PNG, Buffer.alloc(EMBLEM_MAX_BYTES + 10)]);
    expect(parseEmblemDataUrl(url("image/png", big)).ok).toBe(false);
    expect(parseEmblemDataUrl("data:image/png;base64,").ok).toBe(false);
    expect(parseEmblemDataUrl("not a data url").ok).toBe(false);
    expect(parseEmblemDataUrl("https://evil.example/x.png").ok).toBe(false);
  });
});
