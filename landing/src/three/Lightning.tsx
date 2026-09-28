import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, Vector3 } from "three";
import { env, flash, thunder } from "./store";

/** A jagged bolt from the clouds to the sea, by midpoint displacement (random is fine here: this is weather, not a game result). */
function boltPath(): Vector3[] {
  let pts = [new Vector3(0, 150, 0), new Vector3((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 12)];
  let spread = 22;
  for (let depth = 0; depth < 6; depth++) {
    const next: Vector3[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const mid = pts[i - 1].clone().add(pts[i]).multiplyScalar(0.5);
      mid.x += (Math.random() - 0.5) * spread;
      mid.z += (Math.random() - 0.5) * spread * 0.4;
      next.push(mid, pts[i]);
    }
    pts = next;
    spread *= 0.55;
  }
  return pts;
}

const pulse = (t: number) => (t < 0.05 ? 1 : t < 0.1 ? 0.2 : t < 0.17 ? 0.85 : Math.max(0, 0.85 - (t - 0.17) * 2.2));

export function Lightning() {
  const bolts = useMemo(() => [boltPath(), boltPath(), boltPath(), boltPath()], []);
  const groups = useRef<Array<Group | null>>([]);
  const state = useRef({ next: 2.5, t: -1, which: 0 });
  const forward = useMemo(() => new Vector3(), []);

  useFrame(({ camera }, delta) => {
    const s = state.current;
    const dt = Math.min(delta, 0.05);
    if (env.lightning > 0.35) {
      s.next -= dt;
      if (s.next <= 0 && s.t < 0) {
        s.t = 0;
        s.next = 2.2 + Math.random() * 5.5;
        s.which = Math.floor(Math.random() * bolts.length);
        const g = groups.current[s.which];
        if (g) {
          camera.getWorldDirection(forward);
          forward.y = 0;
          forward.normalize();
          const dist = 95 + Math.random() * 70;
          const side = (Math.random() - 0.5) * 140;
          g.position.set(camera.position.x + forward.x * dist - forward.z * side, 0, camera.position.z + forward.z * dist + forward.x * side);
        }
        thunder.dispatchEvent(new CustomEvent("strike", { detail: { distance: 95 } }));
      }
    }
    if (s.t >= 0) {
      s.t += dt;
      flash.value = pulse(s.t) * env.lightning;
      if (s.t > 0.6) {
        s.t = -1;
        flash.value = 0;
      }
    } else flash.value = 0;
    groups.current.forEach((g, i) => {
      if (g) g.visible = s.t >= 0 && s.t < 0.24 && i === s.which;
    });
  });

  return (
    <>
      {bolts.map((pts, i) => (
        <group key={i} ref={(el) => void (groups.current[i] = el)} visible={false}>
          <Line points={pts} color="#e8f0ff" lineWidth={2.2} toneMapped={false} transparent opacity={0.95} />
          <Line points={pts} color="#8fb4ff" lineWidth={7} toneMapped={false} transparent opacity={0.25} />
        </group>
      ))}
    </>
  );
}
