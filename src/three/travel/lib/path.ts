// New (2026-09-29), pure: replaces landing's scroll-driven `shipTrack(v)` (three/store.ts) with a short,
// time-based path for a clip a few seconds long instead of a whole scroll chapter. Same sine-wiggle shape as
// landing's, just parameterized by an eased progress `t` and scaled down to a travel distance that reads as
// "a ship sailing off," not a cross-sea voyage.

const TRAVEL_LENGTH = 34;
const WIGGLE_AMPLITUDE = 3.2;
const WIGGLE_FREQ = 1.6;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export interface ShipTrack {
  x: number;
  z: number;
  /** Heading direction (not a unit tangent) — same convention as landing's shipTrack, only used via atan2. */
  dx: number;
  dz: number;
}

/** `t` is clip progress, 0..1 (clamped). */
export function shipPosition(t: number): ShipTrack {
  const clamped = Math.min(1, Math.max(0, t));
  const eased = easeInOut(clamped);
  const z = -eased * TRAVEL_LENGTH;
  const x = Math.sin(eased * WIGGLE_FREQ) * WIGGLE_AMPLITUDE;
  const dz = -TRAVEL_LENGTH;
  const dx = Math.cos(eased * WIGGLE_FREQ) * WIGGLE_FREQ * WIGGLE_AMPLITUDE;
  return { x, z, dx, dz };
}
