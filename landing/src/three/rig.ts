import { smoothstep } from "../lib/voyage";

type V3 = [number, number, number];

interface RigKey {
  v: number;
  cam: V3;
  look: V3;
}

/** Where the camera sits and looks, relative to the ship, at each beat of the voyage (wide screens: ship on the right, text on the left). */
const WIDE: RigKey[] = [
  { v: 0, cam: [-6, 3.2, 16], look: [-7.5, 3.6, -16] },
  { v: 0.4, cam: [-11, 4.8, 11], look: [3, 2.6, -9] },
  { v: 1, cam: [-19, 9.5, 38], look: [4, 25, -58] },
  { v: 1.55, cam: [-9, 12, 16], look: [6, 4, -30] },
  { v: 2, cam: [14, 8, 20], look: [-1, 12, -60] },
  { v: 2.5, cam: [7, 3.5, 12], look: [-4, 3.5, -14] },
  { v: 3, cam: [-12, 3.5, 16], look: [4, 5, -24] },
  { v: 3.55, cam: [-5, 5.5, 14], look: [0, 6, -40] },
  { v: 4, cam: [-16, 7, 22], look: [4.4, 21, -120] },
];

/** Phones: the ship sits centred in the lower half, below the text, and the camera stands further back. */
const TALL: RigKey[] = [
  { v: 0, cam: [-3, 5.8, 25], look: [-1, 9.6, -14] },
  { v: 0.4, cam: [-12, 6.5, 18], look: [1, 5, -9] },
  { v: 1, cam: [-18, 12, 44], look: [30, 30, -70] },
  { v: 1.55, cam: [-8, 14, 24], look: [4, 7, -30] },
  { v: 2, cam: [12, 11, 30], look: [-24, 12, -60] },
  { v: 2.5, cam: [7, 5.5, 19], look: [-2, 6, -14] },
  { v: 3, cam: [-8, 4.5, 20], look: [10, 6.5, -24] },
  { v: 3.55, cam: [-4, 7, 21], look: [0, 8, -40] },
  { v: 4, cam: [3, 8.5, 34], look: [-1, 21, -90] },
];

export function sampleRig(v: number, aspect: number, cam: V3, look: V3): void {
  const tall = smoothstep(0.95, 0.55, aspect);
  for (const [keys, w] of [
    [WIDE, 1 - tall],
    [TALL, tall],
  ] as const) {
    if (w === 0) continue;
    let i = 0;
    while (i < keys.length - 2 && v > keys[i + 1].v) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const f = smoothstep(0, 1, (v - a.v) / (b.v - a.v));
    for (let k = 0; k < 3; k++) {
      cam[k] += (a.cam[k] + (b.cam[k] - a.cam[k]) * f) * w;
      look[k] += (a.look[k] + (b.look[k] - a.look[k]) * f) * w;
    }
  }
}
