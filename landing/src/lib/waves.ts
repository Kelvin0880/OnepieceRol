/** Gerstner swell shared by the ocean shader (GPU) and the ship's bobbing (CPU), so the hull rides the waves it is drawn on. */
export interface Wave {
  dir: [number, number];
  steepness: number;
  length: number;
}

export const WAVES: Wave[] = [
  { dir: [1, 0.35], steepness: 0.17, length: 42 },
  { dir: [0.65, 1], steepness: 0.13, length: 27 },
  { dir: [-0.45, 1], steepness: 0.11, length: 17 },
  { dir: [0.2, -1], steepness: 0.08, length: 10.5 },
  { dir: [-1, -0.55], steepness: 0.06, length: 6.8 },
];

/** Slows the physical phase speed down a little: at the scene's scale real swell reads as frantic. */
export const TIME_SCALE = 0.62;
const G = 9.8;

interface Prepared {
  dx: number;
  dz: number;
  k: number;
  c: number;
  steepness: number;
}

const PREPARED: Prepared[] = WAVES.map((w) => {
  const len = Math.hypot(w.dir[0], w.dir[1]);
  const k = (2 * Math.PI) / w.length;
  return { dx: w.dir[0] / len, dz: w.dir[1] / len, k, c: Math.sqrt(G / k), steepness: w.steepness };
});

export function maxAmplitude(rough: number): number {
  return PREPARED.reduce((sum, w) => sum + (w.steepness * rough) / w.k, 0);
}

export function waveHeight(x: number, z: number, time: number, rough: number): number {
  const t = time * TIME_SCALE;
  let y = 0;
  for (const w of PREPARED) {
    const f = w.k * (w.dx * x + w.dz * z - w.c * t);
    y += ((w.steepness * rough) / w.k) * Math.sin(f);
  }
  return y;
}

/** Surface normal from the height field's slope (good enough to tilt a hull). */
export function waveNormal(x: number, z: number, time: number, rough: number): [number, number, number] {
  const t = time * TIME_SCALE;
  let sx = 0;
  let sz = 0;
  for (const w of PREPARED) {
    const f = w.k * (w.dx * x + w.dz * z - w.c * t);
    const s = w.steepness * rough * Math.cos(f);
    sx += w.dx * s;
    sz += w.dz * s;
  }
  const len = Math.hypot(sx, 1, sz);
  return [-sx / len, 1 / len, -sz / len];
}

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** GLSL for the same waves: `vec3 gerstner(vec2 p, float t, float rough, inout vec3 tangent, inout vec3 binormal)`. */
export const GERSTNER_GLSL = `
#define WAVE_COUNT ${PREPARED.length}
const float WAVE_TIME = ${f(TIME_SCALE)};
vec3 gerstnerWave(vec4 w, vec2 p, float t, float rough, inout vec3 tangent, inout vec3 binormal) {
  float k = w.w;
  float c = sqrt(${f(G)} / k);
  vec2 d = w.xy;
  float steep = w.z * rough;
  float ph = k * (dot(d, p) - c * t);
  float a = steep / k;
  float s = sin(ph);
  float co = cos(ph);
  tangent += vec3(-d.x * d.x * steep * s, d.x * steep * co, -d.x * d.y * steep * s);
  binormal += vec3(-d.x * d.y * steep * s, d.y * steep * co, -d.y * d.y * steep * s);
  return vec3(d.x * a * co, a * s, d.y * a * co);
}
vec3 gerstner(vec2 p, float time, float rough, inout vec3 tangent, inout vec3 binormal) {
  float t = time * WAVE_TIME;
  vec3 sum = vec3(0.0);
${PREPARED.map((w) => `  sum += gerstnerWave(vec4(${f(w.dx)}, ${f(w.dz)}, ${f(w.steepness)}, ${f(w.k)}), p, t, rough, tangent, binormal);`).join("\n")}
  return sum;
}
`;
