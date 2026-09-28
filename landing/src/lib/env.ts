import { MAX_SEA, smoothstep } from "./voyage";

/** One mood per stop of the route, written in sRGB hex so it can be tuned by eye. */
export interface EnvKey {
  skyTop: string;
  skyHorizon: string;
  fog: string;
  deep: string;
  shallow: string;
  sun: string;
  cloud: string;
  /** Degrees above the horizon; negative hides the sun. */
  sunElevation: number;
  /** Degrees from straight ahead (the ship sails towards -z); positive turns right. */
  sunAzimuth: number;
  sunIntensity: number;
  clouds: number;
  stars: number;
  rough: number;
  foam: number;
  fogNear: number;
  fogFar: number;
  rain: number;
  lightning: number;
  birds: number;
  glory: number;
  light: number;
}

export const ENV_KEYS: EnvKey[] = [
  // East Blue: a golden morning on calm water.
  { skyTop: "#173f78", skyHorizon: "#e4a26c", fog: "#cf9a72", deep: "#042640", shallow: "#0c5f78", sun: "#ffcb8a", cloud: "#e9cdb5", sunElevation: 8, sunAzimuth: 16, sunIntensity: 1, clouds: 0.5, stars: 0, rough: 0.7, foam: 0.22, fogNear: 50, fogFar: 240, rain: 0, lightning: 0, birds: 1, glory: 0, light: 1 },
  // Reverse Mountain and the Red Line: a burning sunset.
  { skyTop: "#241646", skyHorizon: "#e8683a", fog: "#c86446", deep: "#0a1a31", shallow: "#27536a", sun: "#ff7034", cloud: "#e59a78", sunElevation: 4, sunAzimuth: 30, sunIntensity: 1.1, clouds: 0.6, stars: 0.05, rough: 0.85, foam: 0.18, fogNear: 60, fogFar: 340, rain: 0, lightning: 0, birds: 0.5, glory: 0, light: 0.82 },
  // Paradise: pink dusk, first stars, Sabaody's bubbles.
  { skyTop: "#0d1538", skyHorizon: "#b05f7c", fog: "#8e5c77", deep: "#071c36", shallow: "#185a74", sun: "#ff8f84", cloud: "#cf8aa2", sunElevation: 1.5, sunAzimuth: -14, sunIntensity: 0.7, clouds: 0.4, stars: 0.5, rough: 0.8, foam: 0.28, fogNear: 40, fogFar: 210, rain: 0, lightning: 0, birds: 0.25, glory: 0, light: 0.6 },
  // New World: a night storm.
  { skyTop: "#020409", skyHorizon: "#18202d", fog: "#131a25", deep: "#020d16", shallow: "#0b2a36", sun: "#6f86b8", cloud: "#222a39", sunElevation: 24, sunAzimuth: 50, sunIntensity: 0.12, clouds: 1, stars: 0, rough: 1.45, foam: 0.95, fogNear: 14, fogFar: 125, rain: 1, lightning: 1, birds: 0, glory: 0.25, light: 0.28 },
  // Laugh Tale: the dawn after everything.
  { skyTop: "#121a42", skyHorizon: "#f0b764", fog: "#dca062", deep: "#082842", shallow: "#1f7479", sun: "#ffd894", cloud: "#f2d2a6", sunElevation: 5, sunAzimuth: 0, sunIntensity: 1.3, clouds: 0.42, stars: 0.12, rough: 0.6, foam: 0.22, fogNear: 55, fogFar: 280, rain: 0, lightning: 0, birds: 0.35, glory: 1, light: 1 },
];

export type Rgb = [number, number, number];

export interface Env {
  skyTop: Rgb;
  skyHorizon: Rgb;
  fog: Rgb;
  deep: Rgb;
  shallow: Rgb;
  sun: Rgb;
  cloud: Rgb;
  sunDir: Rgb;
  sunIntensity: number;
  clouds: number;
  stars: number;
  rough: number;
  foam: number;
  fogNear: number;
  fogFar: number;
  rain: number;
  lightning: number;
  birds: number;
  glory: number;
  light: number;
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function hexToLinear(hex: string): Rgb {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad colour ${hex}`);
  return [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255)) as Rgb;
}

export function sunDirection(elevationDeg: number, azimuthDeg: number): Rgb {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

const COLOR_KEYS = ["skyTop", "skyHorizon", "fog", "deep", "shallow", "sun", "cloud"] as const;
const NUMBER_KEYS = ["sunIntensity", "clouds", "stars", "rough", "foam", "fogNear", "fogFar", "rain", "lightning", "birds", "glory", "light"] as const;

const LINEAR = ENV_KEYS.map((k) => ({
  ...Object.fromEntries(COLOR_KEYS.map((c) => [c, hexToLinear(k[c])])),
  sunDir: sunDirection(k.sunElevation, k.sunAzimuth),
})) as unknown as Array<Record<(typeof COLOR_KEYS)[number] | "sunDir", Rgb>>;

export function createEnv(): Env {
  return sampleEnv(0);
}

/** The mood at a point of the voyage, eased between the two stops around it; pass `out` to reuse an object every frame. */
export function sampleEnv(v: number, out?: Env): Env {
  const x = Math.min(MAX_SEA, Math.max(0, v));
  const i = Math.min(MAX_SEA - 1, Math.floor(x));
  const f = smoothstep(0, 1, x - i);
  const a = ENV_KEYS[i];
  const b = ENV_KEYS[i + 1];
  const la = LINEAR[i];
  const lb = LINEAR[i + 1];
  const env = out ?? ({} as Env);
  for (const c of [...COLOR_KEYS, "sunDir"] as const) {
    const target = (env[c] as Rgb | undefined) ?? ([0, 0, 0] as Rgb);
    for (let k = 0; k < 3; k++) target[k] = la[c][k] + (lb[c][k] - la[c][k]) * f;
    env[c] = target;
  }
  const len = Math.hypot(env.sunDir[0], env.sunDir[1], env.sunDir[2]) || 1;
  for (let k = 0; k < 3; k++) env.sunDir[k] /= len;
  for (const n of NUMBER_KEYS) env[n] = a[n] + (b[n] - a[n]) * f;
  return env;
}

export function toCss(rgb: Rgb): string {
  const enc = (c: number) => {
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, s)) * 255);
  };
  return `rgb(${enc(rgb[0])}, ${enc(rgb[1])}, ${enc(rgb[2])})`;
}
