// Adapted from landing/src/lib/quality.ts (2026-09-29), trimmed to 2 buckets instead of 3. Landing's
// PerformanceMonitor-driven mid-scene downgrade exists to adapt quality during a multi-minute scroll journey;
// this clip is a few seconds long, so quality is decided ONCE at mount from static device hints and never
// changes mid-clip — that's also why there's no `lowerTier`/`onDecline` here.

export type Tier = "on" | "off";

export interface DeviceHints {
  webgl: boolean;
  reducedMotion: boolean;
  coarsePointer: boolean;
  width: number;
  cores?: number;
  memoryGb?: number;
  saveData?: boolean;
}

/** "off" means no WebGL canvas at all: the caller falls back to a painted sky. */
export function pickTier(h: DeviceHints): Tier {
  if (!h.webgl || h.reducedMotion || h.saveData) return "off";
  if ((h.memoryGb !== undefined && h.memoryGb <= 2) || (h.cores !== undefined && h.cores <= 2)) return "off";
  if (h.coarsePointer && h.cores !== undefined && h.cores <= 4) return "off";
  return "on";
}

/** One fixed quality, good on both phone and desktop — no per-tier table needed with only one "on" bucket. */
export const SETTINGS = {
  dpr: [1, 1.5] as [number, number],
  oceanRadial: 90,
  oceanRings: 60,
};
