import { BufferGeometry, Color, Float32BufferAttribute } from "three";

/** Deterministic value noise for sculpting rocks at load time (visual only). */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function noise3(x: number, y: number, z: number, seed = 1): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

export function fbm3(x: number, y: number, z: number, seed = 1, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f, seed + i * 17);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** Pushes every vertex along its direction from the vertical axis, so cones and cylinders turn into rock. */
export function sculpt(g: BufferGeometry, amount: number, freq: number, seed: number, keepBase = true): BufferGeometry {
  const pos = g.getAttribute("position");
  let minY = Infinity;
  for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const n = fbm3(x * freq, y * freq, z * freq, seed) - 0.5;
    const k = keepBase ? Math.min(1, (y - minY) / 3 + 0.35) : 1;
    const s = 1 + (n * amount * k) / Math.max(r, 1);
    pos.setXYZ(i, x * s, y + n * amount * 0.25, z * s);
  }
  g.computeVertexNormals();
  return g;
}

/** Vertex colours by height and slope: sand at the waterline, green on the flats, rock on cliffs, snow on top. */
export function paint(g: BufferGeometry, bands: { sand?: string; grass?: string; rock: string; snow?: string; snowLine?: number; sandLine?: number; tint?: number }): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.computeVertexNormals();
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const colors: number[] = [];
  const sand = new Color(bands.sand ?? bands.rock);
  const grass = new Color(bands.grass ?? bands.rock);
  const rock = new Color(bands.rock);
  const snow = new Color(bands.snow ?? bands.rock);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const up = nor.getY(i);
    if (bands.snow && y > (bands.snowLine ?? 1e9)) c.copy(snow);
    else if (bands.sand && y < (bands.sandLine ?? 1.2)) c.copy(sand);
    else if (bands.grass && up > 0.55) c.copy(grass);
    else c.copy(rock);
    const jitter = 0.9 + noise3(pos.getX(i) * 0.3, y * 0.3, pos.getZ(i) * 0.3, 7) * (bands.tint ?? 0.2);
    colors.push(c.r * jitter, c.g * jitter, c.b * jitter);
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geo;
}

/** Bakes each geometry's own position into a copy, so many small parts can be merged into one draw call. */
export function placed(g: BufferGeometry, x: number, y: number, z: number, opts: { rx?: number; ry?: number; rz?: number; s?: number | [number, number, number] } = {}): BufferGeometry {
  const c = g.clone();
  const s = opts.s ?? 1;
  const [sx, sy, sz] = typeof s === "number" ? [s, s, s] : s;
  c.scale(sx, sy, sz);
  if (opts.rx) c.rotateX(opts.rx);
  if (opts.ry) c.rotateY(opts.ry);
  if (opts.rz) c.rotateZ(opts.rz);
  c.translate(x, y, z);
  return c;
}

export function colored(g: BufferGeometry, hex: string): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const c = new Color(hex);
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geo;
}
