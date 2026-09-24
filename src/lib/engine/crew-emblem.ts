/**
 * Crew emblem (flag) images. Stored in the database as bytes and served by a dedicated route, so the
 * ~10 s state poll never carries image data. Only raster formats are accepted (never SVG: it can carry
 * scripts), the declared type must match the file's magic bytes, and the size is capped. Pure.
 */
export const EMBLEM_MAX_BYTES = 200_000;
export const EMBLEM_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type EmblemMime = (typeof EMBLEM_MIME_TYPES)[number];

export type EmblemParse = { ok: true; mime: EmblemMime; bytes: Buffer } | { ok: false; reason: string };

function sniff(b: Buffer): EmblemMime | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 6 && (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a")) return "image/gif";
  return null;
}

export function parseEmblemDataUrl(dataUrl: string): EmblemParse {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!m) return { ok: false, reason: "La imagen no tiene un formato válido." };
  const declared = m[1].toLowerCase();
  if (!(EMBLEM_MIME_TYPES as readonly string[]).includes(declared)) return { ok: false, reason: "Solo se admiten imágenes PNG, JPG, WebP o GIF." };
  const bytes = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  if (bytes.length === 0) return { ok: false, reason: "La imagen está vacía." };
  if (bytes.length > EMBLEM_MAX_BYTES) return { ok: false, reason: `La imagen pesa demasiado (máximo ${Math.round(EMBLEM_MAX_BYTES / 1000)} KB).` };
  const real = sniff(bytes);
  if (!real || real !== declared) return { ok: false, reason: "El contenido no coincide con el tipo de imagen indicado." };
  return { ok: true, mime: real, bytes };
}
