// Ported from landing/src/three/shipParts.ts (2026-09-29) — fully procedural hull/rail/sail/jib geometry plus
// a canvas-drawn emblem texture, no GLTF asset. One deliberate deviation from the landing original: the wear
// speckles used the JS Math object's random-number call, which src/lib/no-dice.test.ts forbids anywhere in
// src/ (the owner's "no dice decides a game outcome" rule) — this is purely decorative canvas noise, never a
// player-facing result, so a fixed-seed PRNG (see `mulberry32` below) replaces it rather than carving an
// exception into that guard.
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  PlaneGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const HULL = { length: 7.2, width: 2.35, height: 1.5 };

function hullWidth(t: number, yN: number): number {
  const bow = smooth(0, 0.45, t);
  const stern = 1 - 0.16 * smooth(0.75, 1, t);
  const flare = 0.32 + 0.68 * Math.pow(Math.max(0, yN), 0.55);
  return Math.max(0.015, bow * stern) * flare;
}

function hullLift(t: number, yN: number): number {
  const e = Math.abs(2 * t - 1);
  const rocker = (1 - yN) * 0.6 * Math.pow(e, 2.6);
  const sheer = yN * (0.55 * Math.pow(Math.max(0, 1 - 2 * t), 2) + 0.42 * Math.pow(Math.max(0, 2 * t - 1), 2));
  return rocker + sheer;
}

/** A box bent into a hull: pointed bow at -z, raised bow and stern, V-shaped keel. Colours are painted per original face. */
export function makeHull(palette: { deck: string; side: string; stripe: string; bottom: string }): BufferGeometry {
  const { length: L, width: W, height: H } = HULL;
  const g = new BoxGeometry(W, H, L, 10, 10, 40);
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const colors: number[] = [];
  const deck = new Color(palette.deck);
  const side = new Color(palette.side);
  const stripe = new Color(palette.stripe);
  const bottom = new Color(palette.bottom);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (z + L / 2) / L;
    const yN = (y + H / 2) / H;
    if (nor.getY(i) > 0.9) c.copy(deck);
    else if (yN < 0.3) c.copy(bottom);
    else if (yN > 0.78 && yN < 0.9) c.copy(stripe);
    else c.copy(side).multiplyScalar(0.85 + 0.3 * ((Math.round(yN * 9) % 2) * 0.5));
    colors.push(c.r, c.g, c.b);
    pos.setXYZ(i, (x / (W / 2)) * (W / 2) * hullWidth(t, yN), y + hullLift(t, yN), z);
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** The rim of the hull at deck height, one side: used for the rails. */
export function railCurve(sideSign: 1 | -1): CatmullRomCurve3 {
  const { length: L, width: W, height: H } = HULL;
  const pts: Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = 0.04 + (i / 16) * 0.95;
    const z = t * L - L / 2;
    pts.push(new Vector3(sideSign * (W / 2) * hullWidth(t, 1) * 0.97, H / 2 + hullLift(t, 1) + 0.28, z));
  }
  return new CatmullRomCurve3(pts);
}

export function makeRail(sideSign: 1 | -1): TubeGeometry {
  return new TubeGeometry(railCurve(sideSign), 48, 0.05, 5, false);
}

/** A sail with a static belly pushed towards the bow; the flutter is added in the shader. */
export function makeSail(width: number, height: number, belly: number): PlaneGeometry {
  const g = new PlaneGeometry(width, height, 14, 12);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / width + 0.5;
    const v = pos.getY(i) / height + 0.5;
    pos.setZ(i, -belly * Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(Math.PI * v)));
  }
  g.computeVertexNormals();
  return g;
}

export function makeJib(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 3.3, 0, 0, 0.1, -2.9], 3));
  g.setAttribute("uv", new Float32BufferAttribute([1, 0, 1, 1, 0, 0], 2));
  g.computeVertexNormals();
  return g;
}

/** An original skull-and-crossbones, drawn on a canvas so no image file is needed. */
export function makeEmblemTexture(opts: { cloth: string; ink: string; size?: number; wear?: boolean }): CanvasTexture {
  const size = opts.size ?? 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = opts.cloth;
  ctx.fillRect(0, 0, size, size);
  if (opts.wear) {
    const rand = mulberry32(1337);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.05})`;
      ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 30, 1 + rand() * 3);
    }
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(60,40,20,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const s = size / 512;
  ctx.save();
  ctx.translate(size / 2, size / 2 + 14 * s);
  ctx.fillStyle = opts.ink;
  for (const rot of [0.72, -0.72]) {
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.roundRect(-165 * s, -17 * s, 330 * s, 34 * s, 17 * s);
    ctx.fill();
    for (const ex of [-165, 165]) {
      for (const ey of [-20, 20]) {
        ctx.beginPath();
        ctx.arc(ex * s, ey * s, 25 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, -48 * s, 104 * s, 96 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-58 * s, 20 * s, 116 * s, 62 * s, 16 * s);
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  for (const ex of [-40, 40]) {
    ctx.beginPath();
    ctx.ellipse(ex * s, -42 * s, 28 * s, 32 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-12 * s, 22 * s);
  ctx.lineTo(12 * s, 22 * s);
  ctx.closePath();
  ctx.fill();
  for (const tx of [-30, -10, 10, 30]) ctx.fillRect((tx - 4) * s, 48 * s, 8 * s, 30 * s);
  ctx.restore();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = opts.cloth;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
