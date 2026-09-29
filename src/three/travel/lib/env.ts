// Adapted from landing/src/lib/env.ts (2026-09-29). Landing blends across a fixed 5-stop scroll route; this
// module instead picks ONE mood directly for a given island (no journey to sample along) — see `pickMood`.
// Fields tied only to landing's Rain/Lightning/Landmarks/Birds components (which this trimmed scene never
// renders) were dropped rather than carried as dead weight: `rain`, `lightning`, `glory`, `birds`.

/** One mood, written in sRGB hex so it can be tuned by eye. */
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
  light: number;
}

// Presets ported verbatim from landing/src/lib/env.ts's ENV_KEYS — same three sea-family moods, plus the two
// that happen to match real seeded island names exactly (see OVERRIDES below), reused rather than retuned.
const EAST_BLUE: EnvKey = { skyTop: "#173f78", skyHorizon: "#e4a26c", fog: "#cf9a72", deep: "#042640", shallow: "#0c5f78", sun: "#ffcb8a", cloud: "#e9cdb5", sunElevation: 8, sunAzimuth: 16, sunIntensity: 1, clouds: 0.5, stars: 0, rough: 0.7, foam: 0.22, fogNear: 50, fogFar: 240, light: 1 };
const REVERSE_MOUNTAIN: EnvKey = { skyTop: "#241646", skyHorizon: "#e8683a", fog: "#c86446", deep: "#0a1a31", shallow: "#27536a", sun: "#ff7034", cloud: "#e59a78", sunElevation: 4, sunAzimuth: 30, sunIntensity: 1.1, clouds: 0.6, stars: 0.05, rough: 0.85, foam: 0.18, fogNear: 60, fogFar: 340, light: 0.82 };
const PARADISE: EnvKey = { skyTop: "#0d1538", skyHorizon: "#b05f7c", fog: "#8e5c77", deep: "#071c36", shallow: "#185a74", sun: "#ff8f84", cloud: "#cf8aa2", sunElevation: 1.5, sunAzimuth: -14, sunIntensity: 0.7, clouds: 0.4, stars: 0.5, rough: 0.8, foam: 0.28, fogNear: 40, fogFar: 210, light: 0.6 };
const NEW_WORLD: EnvKey = { skyTop: "#020409", skyHorizon: "#18202d", fog: "#131a25", deep: "#020d16", shallow: "#0b2a36", sun: "#6f86b8", cloud: "#222a39", sunElevation: 24, sunAzimuth: 50, sunIntensity: 0.12, clouds: 1, stars: 0, rough: 1.45, foam: 0.95, fogNear: 14, fogFar: 125, light: 0.28 };
const LAUGH_TALE: EnvKey = { skyTop: "#121a42", skyHorizon: "#f0b764", fog: "#dca062", deep: "#082842", shallow: "#1f7479", sun: "#ffd894", cloud: "#f2d2a6", sunElevation: 5, sunAzimuth: 0, sunIntensity: 1.3, clouds: 0.42, stars: 0.12, rough: 0.6, foam: 0.22, fogNear: 55, fogFar: 280, light: 1 };

/** `Island.sea` (Prisma enum) -> base mood. The three unused Blues fall back to East Blue's mood. */
const BASE_BY_SEA: Record<string, EnvKey> = {
  EAST_BLUE,
  WEST_BLUE: EAST_BLUE,
  NORTH_BLUE: EAST_BLUE,
  SOUTH_BLUE: EAST_BLUE,
  PARADISE,
  NEW_WORLD,
};

/**
 * Hand-picked overrides keyed by `Island.name` (exact match, `@unique` in the schema). Only the two that are
 * a free win today — these seeded island names happen to match landing's chapter names exactly. More iconic
 * islands (Wano, Skypiea, Impel Down, Marineford, Zou, Isla Abismo) are good follow-up candidates, deliberately
 * left out of this first pass.
 */
const OVERRIDES: Record<string, EnvKey> = {
  "Reverse Mountain": REVERSE_MOUNTAIN,
  "Laugh Tale": LAUGH_TALE,
};

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

function linearize(k: EnvKey): Env {
  return {
    skyTop: hexToLinear(k.skyTop),
    skyHorizon: hexToLinear(k.skyHorizon),
    fog: hexToLinear(k.fog),
    deep: hexToLinear(k.deep),
    shallow: hexToLinear(k.shallow),
    sun: hexToLinear(k.sun),
    cloud: hexToLinear(k.cloud),
    sunDir: sunDirection(k.sunElevation, k.sunAzimuth),
    sunIntensity: k.sunIntensity,
    clouds: k.clouds,
    stars: k.stars,
    rough: k.rough,
    foam: k.foam,
    fogNear: k.fogNear,
    fogFar: k.fogFar,
    light: k.light,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/**
 * The mood for one island: an exact-name override wins, else the sea's base mood (falling back to East Blue
 * for an unrecognized `sea`), then `dangerLevel` (1-10, already on every seeded row) scales the storm-related
 * knobs continuously — a dangerous island visibly differs from a calm one of the same sea without any
 * per-island authoring. Never throws.
 */
export function pickMood(sea: string, name: string, dangerLevel: number): Env {
  const base = OVERRIDES[name] ?? BASE_BY_SEA[sea] ?? EAST_BLUE;
  const env = linearize(base);
  const d = Math.min(10, Math.max(1, dangerLevel));
  const t = (d - 1) / 9;
  env.rough *= lerp(0.85, 1.35, t);
  env.foam = Math.min(1, env.foam * lerp(0.85, 1.35, t));
  env.fogNear *= lerp(1, 0.7, t);
  env.fogFar *= lerp(1, 0.75, t);
  return env;
}

export function toCss(rgb: Rgb): string {
  const enc = (c: number) => {
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, s)) * 255);
  };
  return `rgb(${enc(rgb[0])}, ${enc(rgb[1])}, ${enc(rgb[2])})`;
}
