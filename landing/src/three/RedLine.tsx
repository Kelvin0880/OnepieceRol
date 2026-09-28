import { Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, MeshStandardMaterial, ShaderMaterial, SphereGeometry } from "three";
import { colored, fbm3, paint, placed, sculpt } from "./geo";
import { merge, useFade } from "./fade";
import { NOISE_GLSL } from "./glsl";
import { SEG } from "./store";
import { U } from "./uniforms";

const MOUNTAIN = { x: 72, z: -SEG - 118, r: 50, h: 124 };
/** The Red Line runs across the horizon from the mountain to the east, so the route never has to cross it. */
const WALL = { x: 215, z: -SEG - 175, length: 300, height: 210 };

function wallGeometry(): BufferGeometry {
  const g = new BoxGeometry(WALL.length, WALL.height, 40, 72, 48, 8);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const xN = 0.5 - x / WALL.length;
    // The wall sinks towards the mountain so its end hides behind the peak instead of stopping in a straight edge.
    const drop = 1 - 0.62 * Math.pow(Math.min(1, Math.max(0, (xN - 0.55) / 0.45)), 1.4);
    const ragged = (fbm3(x * 0.05, y * 0.05, 9.7, 23) - 0.5) * 26 * (1 - drop);
    const top = y + WALL.height / 2;
    pos.setY(i, top * drop + ragged * (top / WALL.height) - WALL.height / 2);
    if (z > 0) {
      const n = fbm3(y * 0.035, x * 0.03, 3.1, 11) - 0.5;
      const strata = Math.sin(y * 0.22 + n * 6) * 1.6;
      pos.setZ(i, z + n * 30 + strata);
    }
  }
  g.computeVertexNormals();
  return paint(g, { rock: "#8a2f22", grass: "#9e3d2a", tint: 0.45 });
}

function palace(): BufferGeometry {
  const white = "#efe9dc";
  const parts: BufferGeometry[] = [];
  const box = new BoxGeometry(1, 1, 1);
  const tower = new CylinderGeometry(1, 1, 1, 10);
  const dome = new SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 11; i++) {
    const x = -4 + i * 14 + (i % 2) * 3;
    const w = 7 + (i % 3) * 4;
    parts.push(colored(placed(box, x, 3 + (i % 2) * 2, 0, { s: [w, 6 + (i % 3) * 3, 12] }), white));
    if (i % 2 === 0) {
      parts.push(colored(placed(tower, x + 3, 9, 2, { s: [1.8, 13, 1.8] }), white));
      parts.push(colored(placed(dome, x + 3, 15.5, 2, { s: 2.4 }), "#d9b25a"));
    }
  }
  return merge(parts);
}

/** A ribbon of water climbing the mountain face that looks at the route. */
function riverGeometry(): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const steps = 70;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const y = s * (MOUNTAIN.h - 12);
    const r = MOUNTAIN.r * (1 - y / MOUNTAIN.h) + 4.5;
    const phi = 1.85 + s * 0.45;
    const cx = Math.cos(phi) * r;
    const cz = Math.sin(phi) * r;
    const half = 4.2 * (1 - s * 0.55);
    const sx = -Math.sin(phi) * half;
    const sz = Math.cos(phi) * half;
    pos.push(cx - sx, y, cz - sz, cx + sx, y, cz + sz);
    uv.push(0, s, 1, s);
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const riverMaterial = () =>
  new ShaderMaterial({
    uniforms: { uTime: U.uTime, uVis: { value: 0 }, uFogNear: U.uFogNear, uFogFar: U.uFogFar },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vDist;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uVis;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying float vDist;
      ${NOISE_GLSL}
      void main() {
        float flow = vUv.y * 22.0 - uTime * 3.2;
        float streak = vnoise(vec2(vUv.x * 7.0, flow)) * 0.7 + vnoise(vec2(vUv.x * 15.0, flow * 2.0)) * 0.3;
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        vec3 col = mix(vec3(0.08, 0.38, 0.55), vec3(0.85, 0.97, 1.0), smoothstep(0.35, 0.85, streak)) * 1.5;
        float fadeTop = smoothstep(1.0, 0.82, vUv.y);
        float fog = 1.0 - smoothstep(uFogNear, uFogFar * 1.15, vDist);
        gl_FragColor = vec4(col * edge * fadeTop * uVis * fog, 1.0);
      }`,
  });

export function RedLine({ sparkles }: { sparkles: number }) {
  const group = useRef<Group>(null);
  const built = useMemo(() => {
    const rock = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    const stone = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    const palaceMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: "#3a2a18", emissiveIntensity: 0.4 });
    const river = riverMaterial();
    const mountain = paint(sculpt(new ConeGeometry(MOUNTAIN.r, MOUNTAIN.h, 56, 26), 11, 0.045, 5), {
      rock: "#6d6258",
      snow: "#f3f1ee",
      snowLine: MOUNTAIN.h * 0.2,
      grass: "#58624a",
      tint: 0.35,
    });
    return { rock, stone, palaceMat, river, geo: { wall: wallGeometry(), palace: palace(), mountain, river: riverGeometry() } };
  }, []);
  useEffect(
    () => () => {
      Object.values(built.geo).forEach((g) => g.dispose());
      [built.rock, built.stone, built.palaceMat, built.river].forEach((m) => m.dispose());
    },
    [built],
  );
  useFade(group, [built.rock, built.stone, built.palaceMat, built.river], 1, 0.8, 0.75);

  return (
    <group ref={group}>
      <mesh geometry={built.geo.wall} material={built.rock} position={[WALL.x, WALL.height / 2 - 20, WALL.z]} />
      <mesh geometry={built.geo.palace} material={built.palaceMat} position={[WALL.x, WALL.height - 20, WALL.z]} />
      <group position={[MOUNTAIN.x, MOUNTAIN.h / 2 - 12, MOUNTAIN.z]}>
        <mesh geometry={built.geo.mountain} material={built.stone} />
      </group>
      <mesh geometry={built.geo.river} material={built.river} position={[MOUNTAIN.x, -10, MOUNTAIN.z]} renderOrder={2} />
      <Sparkles count={sparkles} scale={[30, 50, 30]} position={[MOUNTAIN.x - 19, 22, MOUNTAIN.z + 35]} size={5} speed={1.4} opacity={0.6} color="#e6f6ff" noise={1.5} />
    </group>
  );
}
