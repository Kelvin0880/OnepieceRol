export type Tier = "high" | "medium" | "low";

export interface DeviceHints {
  webgl: boolean;
  reducedMotion: boolean;
  coarsePointer: boolean;
  width: number;
  cores?: number;
  memoryGb?: number;
  saveData?: boolean;
}

/** "none" means no 3D at all: the page falls back to an animated gradient of the same sky. */
export function pickTier(h: DeviceHints): Tier | "none" {
  if (!h.webgl || h.reducedMotion) return "none";
  if (h.saveData) return "low";
  if ((h.memoryGb !== undefined && h.memoryGb <= 2) || (h.cores !== undefined && h.cores <= 2)) return "low";
  if (h.coarsePointer && h.cores !== undefined && h.cores <= 4) return "low";
  if (h.coarsePointer || h.width < 1000 || (h.memoryGb !== undefined && h.memoryGb <= 4)) return "medium";
  return "high";
}

export function lowerTier(t: Tier): Tier {
  return t === "high" ? "medium" : "low";
}

export interface TierSettings {
  dpr: [number, number];
  oceanRadial: number;
  oceanRings: number;
  postprocessing: "full" | "lite" | "off";
  rain: number;
  bubbles: number;
  sparkles: number;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  high: { dpr: [1, 1.75], oceanRadial: 180, oceanRings: 120, postprocessing: "full", rain: 1600, bubbles: 90, sparkles: 160 },
  medium: { dpr: [1, 1.35], oceanRadial: 120, oceanRings: 84, postprocessing: "lite", rain: 800, bubbles: 50, sparkles: 90 },
  low: { dpr: [0.85, 1], oceanRadial: 80, oceanRings: 56, postprocessing: "off", rain: 350, bubbles: 24, sparkles: 40 },
};
