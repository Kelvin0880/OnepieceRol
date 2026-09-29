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

/** Wide screens: camera holds off to one side of the ship. */
const WIDE: RigKey[] = [
  { t: 0, cam: [-6, 3.2, 10], look: [0, 2, -10] },
  { t: 0.5, cam: [4, 4.5, 9], look: [-1, 2.5, -8] },
  { t: 1, cam: [-5, 3.8, 12], look: [0, 3, -14] },
];

/** Phones: camera stands further back, centred behind the ship. */
const TALL: RigKey[] = [
  { t: 0, cam: [-2, 6, 16], look: [0, 4, -8] },
  { t: 0.5, cam: [3, 7, 14], look: [-1, 4, -6] },
  { t: 1, cam: [-2, 6.5, 17], look: [0, 5, -12] },
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
