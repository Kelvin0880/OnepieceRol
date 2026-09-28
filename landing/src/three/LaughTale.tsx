import { Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BufferGeometry, ConeGeometry, CylinderGeometry, Group, MeshStandardMaterial, ShaderMaterial, SphereGeometry } from "three";
import { merge, useFade } from "./fade";
import { paint, placed, sculpt } from "./geo";
import { SEG } from "./store";
import { U } from "./uniforms";

export const LAUGH_TALE_Z = -SEG * 4 - 120;

function islandGeometry(): BufferGeometry {
  const base = new SphereGeometry(48, 56, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  base.scale(1, 0.34, 1);
  base.translate(0, -2, 0);
  const land = paint(sculpt(base, 14, 0.06, 71, false), { sand: "#ecd9a6", sandLine: 1.4, grass: "#56893f", rock: "#8a7a62", tint: 0.35 });
  const parts: BufferGeometry[] = [land];
  const spires = [
    [0, 0, 16, 70],
    [-22, 8, 9, 38],
    [20, 12, 8, 32],
    [-10, -18, 7, 26],
    [26, -14, 6, 22],
  ];
  for (const [x, z, r, h] of spires) {
    const cone = sculpt(new ConeGeometry(r, h, 14, 12), r * 0.5, 0.12, x + z + 90);
    parts.push(paint(placed(cone, x, h / 2 + 2, z), { rock: "#9c8a6c", grass: "#6b8f4a", tint: 0.35 }));
  }
  return merge(parts);
}

const pillarMaterial = (strength: number) =>
  new ShaderMaterial({
    uniforms: { uTime: U.uTime, uVis: { value: 0 }, uStrength: { value: strength }, uFogNear: U.uFogNear, uFogFar: U.uFogFar },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vView;
      varying float vY;
      varying float vDist;
      void main() {
        vY = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uVis;
      uniform float uStrength;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vN;
      varying vec3 vView;
      varying float vY;
      varying float vDist;
      void main() {
        float facing = pow(abs(dot(normalize(vN), normalize(vView))), 1.8);
        float fadeY = smoothstep(0.0, 0.04, vY) * (1.0 - smoothstep(0.2, 0.9, vY));
        float shimmer = 0.8 + 0.2 * sin(vY * 90.0 - uTime * 2.6);
        float fog = 1.0 - 0.6 * smoothstep(uFogNear, uFogFar * 1.6, vDist);
        vec3 col = vec3(1.0, 0.8, 0.42) * uStrength * facing * fadeY * shimmer * uVis * fog;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

export function LaughTale({ sparkles }: { sparkles: number }) {
  const group = useRef<Group>(null);
  const built = useMemo(() => {
    const land = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    const core = pillarMaterial(3.4);
    const halo = pillarMaterial(0.45);
    return { land, core, halo, geo: { island: islandGeometry(), core: new CylinderGeometry(2.6, 3.8, 720, 24, 1, true), halo: new CylinderGeometry(10, 15, 720, 24, 1, true) } };
  }, []);
  useEffect(
    () => () => {
      Object.values(built.geo).forEach((g) => g.dispose());
      [built.land, built.core, built.halo].forEach((m) => m.dispose());
    },
    [built],
  );
  useFade(group, [built.land, built.core, built.halo], 4, 0.85, 2);

  return (
    <group ref={group} position={[0, 0, LAUGH_TALE_Z]}>
      <mesh geometry={built.geo.island} material={built.land} />
      <mesh geometry={built.geo.core} material={built.core} position={[0, 360, 0]} renderOrder={4} />
      <mesh geometry={built.geo.halo} material={built.halo} position={[0, 360, 0]} renderOrder={4} />
      <Sparkles count={sparkles} scale={[110, 90, 110]} position={[0, 40, 0]} size={9} speed={0.35} opacity={0.9} color="#ffd98a" noise={0.8} />
    </group>
  );
}
