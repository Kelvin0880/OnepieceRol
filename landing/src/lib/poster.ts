import { formatBerries, hashString, type SampleBounty } from "./bounty";

export const POSTER_W = 600;
export const POSTER_H = 860;

/** Deterministic noise so the same name always gets the same stains. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, maxWidth: number, start: number, min: number): number {
  let size = start;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/** A hooded stranger in a tricorn hat: the poster before anyone knows your face. */
function silhouette(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Drawn opaque on its own layer and laid down once, so the translucent ink never doubles up where parts overlap.
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const g = layer.getContext("2d");
  if (!g) return;
  const cx = w / 2;
  g.fillStyle = "rgb(48, 31, 14)";
  g.beginPath();
  g.moveTo(w * 0.1, h);
  g.bezierCurveTo(w * 0.12, h * 0.74, cx - w * 0.2, h * 0.66, cx, h * 0.66);
  g.bezierCurveTo(cx + w * 0.2, h * 0.66, w * 0.88, h * 0.74, w * 0.9, h);
  g.closePath();
  g.fill();
  g.beginPath();
  g.roundRect(cx - w * 0.055, h * 0.52, w * 0.11, h * 0.18, 8);
  g.fill();
  g.beginPath();
  g.ellipse(cx, h * 0.47, w * 0.105, h * 0.155, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx - w * 0.3, h * 0.33);
  g.quadraticCurveTo(cx - w * 0.2, h * 0.4, cx, h * 0.37);
  g.quadraticCurveTo(cx + w * 0.2, h * 0.4, cx + w * 0.3, h * 0.33);
  g.quadraticCurveTo(cx + w * 0.2, h * 0.3, cx + w * 0.14, h * 0.24);
  g.quadraticCurveTo(cx, h * 0.1, cx - w * 0.14, h * 0.24);
  g.quadraticCurveTo(cx - w * 0.2, h * 0.3, cx - w * 0.3, h * 0.33);
  g.fill();
  g.fillStyle = "rgb(233, 214, 170)";
  g.font = `bold ${Math.round(h * 0.16)}px Georgia, serif`;
  g.textAlign = "center";
  g.fillText("?", cx, h * 0.53);
  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.drawImage(layer, x, y);
  ctx.restore();
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  // Old print: drop the colour, then tint it sepia.
  ctx.globalCompositeOperation = "saturation";
  ctx.fillStyle = "#808080";
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "#d9b98a";
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

export async function drawPoster(canvas: HTMLCanvasElement, bounty: SampleBounty, photo: ImageBitmap | HTMLImageElement | null): Promise<void> {
  try {
    await Promise.all([document.fonts.load('88px "IM Fell English SC"'), document.fonts.load('bold 60px "Cinzel"')]);
  } catch {
    // Falls back to the serif stack below.
  }
  const W = POSTER_W;
  const H = POSTER_H;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rand = rng(hashString(bounty.name.toLowerCase()));
  const fell = (size: number) => `${size}px "IM Fell English SC", "Cinzel", Georgia, serif`;
  const cinzel = (size: number) => `900 ${size}px "Cinzel", Georgia, serif`;

  const paper = ctx.createLinearGradient(0, 0, W, H);
  paper.addColorStop(0, "#f1dfb2");
  paper.addColorStop(0.5, "#e8d19c");
  paper.addColorStop(1, "#dcc084");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(90, 60, 25, ${rand() * 0.07})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 1.5);
  }
  for (let i = 0; i < 6; i++) {
    const r = 30 + rand() * 90;
    const sx = rand() * W;
    const sy = rand() * H;
    const stain = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r);
    stain.addColorStop(0, "rgba(140, 95, 40, 0.10)");
    stain.addColorStop(1, "rgba(140, 95, 40, 0)");
    ctx.fillStyle = stain;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  const burn = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.72);
  burn.addColorStop(0, "rgba(90, 55, 20, 0)");
  burn.addColorStop(1, "rgba(90, 55, 20, 0.55)");
  ctx.fillStyle = burn;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(59, 42, 23, 0.85)";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  ctx.lineWidth = 1;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  ctx.fillStyle = "#3b2a17";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = fell(fitText(ctx, "SE BUSCA", fell, W - 110, 110, 70));
  ctx.fillText("SE BUSCA", W / 2, 142);

  const px = 70;
  const py = 172;
  const pw = W - 140;
  const ph = 330;
  ctx.fillStyle = "#efe0bb";
  ctx.fillRect(px, py, pw, ph);
  if (photo) drawPhoto(ctx, photo, px, py, pw, ph);
  else {
    const glow = ctx.createRadialGradient(W / 2, py + ph * 0.4, 20, W / 2, py + ph * 0.5, ph * 0.8);
    glow.addColorStop(0, "rgba(255, 245, 220, 0.9)");
    glow.addColorStop(1, "rgba(190, 150, 90, 0.5)");
    ctx.fillStyle = glow;
    ctx.fillRect(px, py, pw, ph);
    silhouette(ctx, px, py, pw, ph);
  }
  ctx.strokeStyle = "#3b2a17";
  ctx.lineWidth = 5;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = "#3b2a17";
  ctx.font = fell(58);
  ctx.fillText("VIVO O MUERTO", W / 2, py + ph + 70);

  const nameSize = fitText(ctx, bounty.name.toUpperCase(), fell, W - 120, 64, 26);
  ctx.font = fell(nameSize);
  ctx.fillText(bounty.name.toUpperCase(), W / 2, py + ph + 142);

  ctx.font = `italic 28px "Crimson Pro", Georgia, serif`;
  ctx.fillStyle = "#5a4020";
  ctx.fillText(`«${bounty.epithet}»`, W / 2, py + ph + 182);

  const amount = `฿ ${formatBerries(bounty.amount)}-`;
  const amountSize = fitText(ctx, amount, cinzel, W - 110, 58, 30);
  ctx.font = cinzel(amountSize);
  ctx.fillStyle = "#2e2011";
  ctx.fillText(amount, W / 2, py + ph + 256);

  ctx.font = fell(20);
  ctx.fillStyle = "rgba(59, 42, 23, 0.8)";
  ctx.fillText("MARINA · GOBIERNO MUNDIAL", W / 2, H - 50);
}

export function posterFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `se-busca-${slug || "desconocido"}.png`;
}
