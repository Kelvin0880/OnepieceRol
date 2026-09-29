// New (2026-09-29): a short 2-4 key camera rig replacing landing's hand-tuned 9-key WIDE/TALL arrays (built
// for a whole 5-chapter scroll journey). Same smoothstep-blend-by-aspect-ratio approach as landing's
// three/rig.ts `sampleRig`, just far less data — this clip only needs "sail off, hold a following shot,
// settle" rather than a multi-stop route.

type V3 = [number, number, number];

interface RigKey {
  t: number;
  cam: V3;
  look: V3;
}

// Tuned 2026-09-29 after the first real-browser pass sat too close behind the sail (a dead-astern low shot
// fills the frame with cloth and hides the ship's silhouette and the sky/mood entirely). Offsets now sit well
// to the side for a three-quarter/broadside cinematic angle — cam/look are relative to the ship's live
// position (added in Scene.tsx), so a bigger |x| here reads as "off to the side," not "far from the world".

/** Wide screens: starts three-quarter from behind-left, sweeps across to the right, settles on a wide
 * receding shot as the ship sails off. */
const WIDE: RigKey[] = [
  { t: 0, cam: [-14, 5, 6], look: [0, 2, -6] },
  { t: 0.5, cam: [12, 6, 4], look: [-2, 2.5, -4] },
  { t: 1, cam: [-10, 5.5, 10], look: [2, 3, -10] },
];

/** Phones: same sweep, camera stands further back so the ship, ocean and sky all fit a narrow (portrait) FOV.
 * Two earlier passes here still read as a dead-astern close-up of the sail — the fiber Canvas's `fov` is
 * vertical, so a tall/narrow aspect ratio has a much narrower HORIZONTAL field of view than desktop's; a
 * lateral offset alone wasn't enough; pulling the whole rig further back (bigger z, not just bigger x) is what
 * actually gets the ship's silhouette, the ocean and the sky all inside a portrait frame. */
const TALL: RigKey[] = [
  { t: 0, cam: [-13, 6, 14], look: [1, 3, -6] },
  { t: 0.5, cam: [12, 7, 12], look: [-2, 3.5, -4] },
  { t: 1, cam: [-10, 6.5, 16], look: [2, 4, -10] },
];

export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** `t` is clip progress, 0..1. Adds the sampled offset into `cam`/`look` (caller zeroes them first). */
export function sampleRig(t: number, aspect: number, cam: V3, look: V3): void {
  const tall = smoothstep(0.95, 0.55, aspect);
  for (const [keys, w] of [
    [WIDE, 1 - tall],
    [TALL, tall],
  ] as const) {
    if (w === 0) continue;
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const f = smoothstep(0, 1, (t - a.t) / (b.t - a.t));
    for (let k = 0; k < 3; k++) {
      cam[k] += (a.cam[k] + (b.cam[k] - a.cam[k]) * f) * w;
      look[k] += (a.look[k] + (b.look[k] - a.look[k]) * f) * w;
    }
  }
}
