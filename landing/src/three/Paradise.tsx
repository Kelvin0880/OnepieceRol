import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  BoxGeometry,
  Vector2,
} from "three";
import { colored, noise3, paint, placed, sculpt } from "./geo";
import { merge, useFade } from "./fade";
import { SEG } from "./store";
import { U } from "./uniforms";

const Z = -SEG * 2;

const rand = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function palm(x: number, z: number, y: number, lean: number, seed: number): BufferGeometry[] {
  const trunk = new CylinderGeometry(0.22, 0.38, 7, 6, 8);
  const pos = trunk.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const ty = pos.getY(i) + 3.5;
    pos.setX(i, pos.getX(i) + Math.pow(ty / 7, 2) * 1.6 * lean);
  }
  trunk.computeVertexNormals();
  const parts = [colored(placed(trunk, x, y + 3.5, z, { ry: seed }), "#6e4d2f")];
  const frond = new ConeGeometry(0.55, 4.6, 4, 1);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + seed;
    parts.push(colored(placed(frond, x + Math.cos(a) * 1.6 + 1.6 * lean, y + 6.7, z + Math.sin(a) * 1.6, { rz: -Math.cos(a) * 1.25, rx: Math.sin(a) * 1.25, s: [1, 1, 0.35] }), k % 2 ? "#2f7a36" : "#3c8c3f"));
  }
  return parts;
}

function island(radius: number, height: number, seed: number, palms: number): BufferGeometry {
  const dome = new SphereGeometry(radius, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, height / radius, 1);
  dome.translate(0, -1.6, 0);
  sculpt(dome, radius * 0.45, 0.08, seed, false);
  const land = paint(dome, { sand: "#e2cf9c", sandLine: 0.9, grass: "#3e7f3a", rock: "#7a6a52", tint: 0.35 });
  const beach = colored(placed(new CylinderGeometry(radius * 1.12, radius * 1.2, 1.6, 40), 0, -0.55, 0), "#e8d6a4");
  const parts: BufferGeometry[] = [land, beach];
  for (let i = 0; i < palms; i++) {
    const a = seed * 1.7 + (i / palms) * Math.PI * 2;
    const r = radius * (0.35 + 0.35 * noise3(i, seed, 1));
    const px = Math.cos(a) * r;
    const pz = Math.sin(a) * r;
    const py = height * Math.sqrt(Math.max(0, 1 - (r / radius) ** 2)) * 0.8 - 1.8;
    parts.push(...palm(px, pz, py, (i % 2 ? 1 : -1) * 0.8, a));
  }
  return merge(parts);
}

function mangroves(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const canopy = new IcosahedronGeometry(1, 1);
  const trees = [
    [0, 0, 1],
    [-17, 11, 0.8],
    [14, 14, 0.9],
  ];
  for (const [tx, tz, s] of trees) {
    const trunk = sculpt(new CylinderGeometry(3.4 * s, 5.2 * s, 48 * s, 12, 8), 1.6, 0.18, tx + 3);
    parts.push(colored(placed(trunk, tx, 24 * s - 2, tz), "#8b6b4b"));
    for (let r = 0; r < 6; r++) {
      const a = (r / 6) * Math.PI * 2 + tx;
      parts.push(colored(placed(new ConeGeometry(1.3 * s, 16 * s, 6), tx + Math.cos(a) * 5 * s, 4 * s, tz + Math.sin(a) * 5 * s, { rz: -Math.cos(a) * 0.55, rx: Math.sin(a) * 0.55 }), "#7a5c3f"));
    }
    for (let c = 0; c < 7; c++) {
      const a = (c / 7) * Math.PI * 2 + tz;
      const rr = c === 0 ? 0 : 8 * s;
      parts.push(colored(placed(canopy, tx + Math.cos(a) * rr, 50 * s + (c % 3) * 2.5, tz + Math.sin(a) * rr, { s: (c === 0 ? 13 : 9) * s }), c % 2 ? "#3d7d45" : "#4f9150"));
    }
  }
  const base = new SphereGeometry(30, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  base.scale(1, 0.14, 1);
  base.translate(0, -1.2, 0);
  parts.push(paint(sculpt(base, 7, 0.1, 19, false), { sand: "#d9c793", sandLine: 1, grass: "#4a7f3f", rock: "#6f624f" }));
  return merge(parts);
}

function skyIsland(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const puff = new IcosahedronGeometry(1, 2);
  const puffs = [
    [0, 0, 0, 12],
    [11, -1, 3, 9],
    [-12, -1, -2, 10],
    [4, -2, -10, 9],
    [-5, -2, 10, 8],
    [18, -3, -6, 6],
    [-20, -3, 7, 6],
  ];
  for (const [x, y, z, s] of puffs) parts.push(colored(placed(puff, x, y, z, { s: [s, s * 0.55, s] }), "#fbf6f2"));
  const pillar = new BoxGeometry(1.4, 7, 1.4);
  for (const [x, z] of [
    [-6, -3],
    [-2, -5],
    [3, -4],
  ])
    parts.push(colored(placed(pillar, x, 7.5, z), "#d8cdb6"));
  return merge(parts);
}

function bell(): BufferGeometry {
  const profile = [
    [0.01, 0],
    [3.2, 0.1],
    [3.3, 0.7],
    [2.7, 1.8],
    [2.25, 3.8],
    [1.7, 5.4],
    [0.6, 6.2],
    [0.01, 6.3],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(profile, 32);
}

const bubbleMaterial = () =>
  new ShaderMaterial({
    uniforms: { uTime: U.uTime, uVis: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float life = fract(aSeed.w + uTime * (0.02 + aSeed.z * 0.018));
        float r = 0.45 + aSeed.x * aSeed.x * 1.6;
        vec3 base = vec3((aSeed.x - 0.5) * 64.0, -1.0, (aSeed.y - 0.5) * 44.0);
        vec3 p = base + vec3(sin(uTime * 0.6 + aSeed.w * 20.0) * 1.8, life * 62.0, cos(uTime * 0.5 + aSeed.z * 20.0) * 1.8);
        float grow = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.86, 1.0, life));
        vec4 mv = modelViewMatrix * vec4(p + position * r * grow, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uVis;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vec3(0.0, 0.33, 0.67)) + uTime * 0.4);
        vec3 col = mix(vec3(0.95), irid, 0.75) * (0.12 + fres * 1.5);
        gl_FragColor = vec4(col * uVis, 1.0);
      }`,
  });

function bubbleGeometry(count: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  const base = new IcosahedronGeometry(1, 2);
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("normal", base.getAttribute("normal"));
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) seeds[i] = rand(i + 1);
  g.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
  g.instanceCount = count;
  return g;
}

export function Paradise({ bubbles }: { bubbles: number }) {
  const group = useRef<Group>(null);
  const bellRef = useRef<Group>(null);
  const built = useMemo(() => {
    const land = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 });
    const cloud = new MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: "#3a2b3a", emissiveIntensity: 0.5, flatShading: false });
    const gold = new MeshStandardMaterial({ color: "#e0b04a", metalness: 0.9, roughness: 0.22, emissive: "#6b4a10", emissiveIntensity: 0.6, side: DoubleSide });
    const bubble = bubbleMaterial();
    return {
      land,
      cloud,
      gold,
      bubble,
      geo: {
        a: island(15, 9, 3, 5),
        b: island(24, 16, 8, 4),
        c: island(11, 6, 13, 3),
        grove: mangroves(),
        sky: skyIsland(),
        bell: bell(),
        bubbles: bubbleGeometry(bubbles),
      },
    };
  }, [bubbles]);
  useEffect(
    () => () => {
      Object.values(built.geo).forEach((g) => g.dispose());
      [built.land, built.cloud, built.gold, built.bubble].forEach((m) => m.dispose());
    },
    [built],
  );
  useFade(group, [built.land, built.cloud, built.gold, built.bubble], 2, 0.85, 0.8, (_vis, t) => {
    if (bellRef.current) bellRef.current.rotation.z = Math.sin(t * 0.9) * 0.08;
  });

  return (
    <group ref={group}>
      <mesh geometry={built.geo.a} material={built.land} position={[-50, 0, Z - 10]} />
      <mesh geometry={built.geo.b} material={built.land} position={[-96, 0, Z - 45]} />
      <mesh geometry={built.geo.c} material={built.land} position={[48, 0, Z - 25]} />
      <group position={[-38, 0, Z - 105]}>
        <mesh geometry={built.geo.grove} material={built.land} />
        <mesh geometry={built.geo.bubbles} material={built.bubble} frustumCulled={false} renderOrder={3} />
      </group>
      <group position={[-40, 78, Z - 130]}>
        <mesh geometry={built.geo.sky} material={built.cloud} />
        <group ref={bellRef} position={[4, 13.5, 0]}>
          <mesh geometry={built.geo.bell} material={built.gold} position={[0, -6.3, 0]} />
        </group>
      </group>
    </group>
  );
}
