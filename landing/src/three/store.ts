import { createEnv } from "../lib/env";

/** Mutable state shared between the DOM (scroll, pointer) and the render loop, read every frame without re-rendering React. */
export const voyage = { target: 0, current: 0 };
export const pointer = { x: 0, y: 0 };
export const env = createEnv();
export const flash = { value: 0 };

/** Fires on every lightning strike so the sound layer can answer with thunder. */
export const thunder = new EventTarget();

export const SEG = 165;

export function shipTrack(v: number): { x: number; z: number; dx: number; dz: number } {
  return { x: Math.sin(v * 1.35) * 5.5, z: -v * SEG, dx: Math.cos(v * 1.35) * 1.35 * 5.5, dz: -SEG };
}
