import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { ConeGeometry, Group, MeshStandardMaterial } from "three";
import { presence } from "../lib/voyage";
import { waveHeight, waveNormal } from "../lib/waves";
import { paint, sculpt } from "./geo";
import { Ship } from "./Ship";
import { env, SEG, voyage } from "./store";

const Z = -SEG * 3;
const FLEET: Array<[number, number, number]> = [
  [44, Z - 60, 0.15],
  [68, Z - 95, -0.1],
  [34, Z - 130, 0.25],
];

/** The New World: a shadow fleet under red lanterns and black sea stacks, only there when the storm is. */
export function Storm() {
  const group = useRef<Group>(null);
  const ships = useRef<Array<Group | null>>([]);
  const built = useMemo(() => {
    const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    const stacks = [0, 1, 2, 3].map((i) => paint(sculpt(new ConeGeometry(7 + i * 2, 46 + i * 14, 18, 14), 5, 0.08, 40 + i), { rock: "#2b3036", grass: "#343a3a", tint: 0.4 }));
    return { mat, stacks };
  }, []);
  useEffect(() => () => (built.stacks.forEach((g) => g.dispose()), built.mat.dispose()), [built]);

  useFrame((state) => {
    const vis = presence(voyage.current, 3, 0.75, 0.62);
    const g = group.current;
    if (!g) return;
    g.visible = vis > 0.002;
    if (!g.visible) return;
    const t = state.clock.elapsedTime;
    FLEET.forEach(([x, z, yaw], i) => {
      const s = ships.current[i];
      if (!s) return;
      const n = waveNormal(x, z, t, env.rough);
      s.position.set(x, waveHeight(x, z, t, env.rough) * 1.1 - 0.35, z);
      s.rotation.set(n[2] * 0.8, yaw, -n[0] * 0.8, "YXZ");
    });
  });

  return (
    <group ref={group}>
      {FLEET.map((_, i) => (
        <Ship key={i} variant="dark" scale={1.8} ref={(el) => void (ships.current[i] = el)} />
      ))}
      {built.stacks.map((geo, i) => (
        <mesh key={i} geometry={geo} material={built.mat} position={[-38 - i * 16, (46 + i * 14) / 2 - 4, Z - 10 - i * 34]} />
      ))}
    </group>
  );
}
