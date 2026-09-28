// Dev helper for tuning the camera (src/three/rig.ts): prints where the ship and each landmark land on screen at every
// chapter, for a desktop and a phone viewport. Keep the positions below in step with the landmark files. Run: npx tsx scripts/frame-check.ts
import { PerspectiveCamera, Vector3 } from "three";
import { sampleRig } from "../src/three/rig";
import { shipTrack } from "../src/three/store";

const targets: Record<string, [number, number, number]> = {
  mountainPeak: [Number(process.env.MX ?? 72), 110, -165 - 118],
  mountainBase: [Number(process.env.MX ?? 72), 10, -165 - 118],
  grove: [Number(process.env.GX ?? -38), 30, -330 - 105],
  sky: [Number(process.env.SX ?? -40), 80, -330 - 130],
  fleet: [Number(process.env.FX ?? 44), 4, -495 - 60],
  laughTale: [0, 20, -660 - 120],
};

for (const [w, h] of [
  [1280, 800],
  [390, 844],
]) {
  const cam = new PerspectiveCamera(50, w / h, 0.3, 3000);
  console.log(`\n== ${w}x${h}`);
  for (const v of [0, 0.42, 1, 2, 3, 4]) {
    const c: [number, number, number] = [0, 0, 0];
    const l: [number, number, number] = [0, 0, 0];
    sampleRig(v, w / h, c, l);
    const t = shipTrack(v);
    cam.position.set(t.x + c[0], c[1], t.z + c[2]);
    cam.lookAt(t.x + l[0], l[1], t.z + l[2]);
    cam.updateMatrixWorld();
    const px = (p: [number, number, number]) => {
      const s = new Vector3(...p).project(cam);
      return s.z > 1 ? "behind" : `${Math.round(((s.x + 1) / 2) * w)},${Math.round(((1 - s.y) / 2) * h)}`;
    };
    const parts = [`ship ${px([t.x, 2, t.z])}`];
    for (const [k, p] of Object.entries(targets)) parts.push(`${k} ${px(p)}`);
    console.log(`v=${v}: ${parts.join(" | ")}`);
  }
}
