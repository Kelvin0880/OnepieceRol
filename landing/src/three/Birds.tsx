import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial } from "three";
import { env } from "./store";
import { U } from "./uniforms";

const COUNT = 9;

/** Gulls circling the ship: one instanced draw, wings flapped in the vertex shader. */
function birdGeometry(): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  // body, left wing, right wing; aWing = how far a vertex swings with the flap
  const pos = [0, 0.06, -0.38, 0, -0.05, -0.3, 0, 0, 0.42, 0, 0, -0.12, 0, 0, 0.16, -0.95, 0.04, 0.06, 0, 0, -0.12, 0.95, 0.04, 0.06, 0, 0, 0.16];
  const wing = [0, 0, 0, 0, 0, 1, 0, 1, 0];
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aWing", new Float32BufferAttribute(wing, 1));
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    seeds.set([i / COUNT, 9 + (i % 4) * 3.2, 7 + (i % 3) * 2.4, 0.18 + (i % 5) * 0.035], i * 4);
  }
  g.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
  g.instanceCount = COUNT;
  return g;
}

export function Birds() {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(birdGeometry, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: DoubleSide,
        uniforms: { uTime: U.uTime, uShip: U.uShip, uFog: U.uFog, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uLight: U.uLight, uScale: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float aWing;
          attribute vec4 aSeed;
          uniform float uTime;
          uniform vec3 uShip;
          uniform float uScale;
          varying float vDist;
          varying float vTip;
          void main() {
            float phase = aSeed.x * 6.2831;
            float flap = sin(uTime * (7.0 + aSeed.x * 3.0) + phase * 3.0) * 0.75;
            vec3 p = position;
            float tip = aWing * abs(p.x);
            p.y += sin(flap) * tip;
            p.x *= mix(1.0, cos(flap), aWing);
            float a = uTime * aSeed.w + phase;
            vec3 center = vec3(uShip.x, 0.0, uShip.y);
            vec3 orbit = vec3(cos(a) * aSeed.y, aSeed.z + sin(uTime * 0.7 + phase) * 0.8, sin(a) * aSeed.y);
            float heading = 3.14159 - a;
            mat3 rot = mat3(cos(heading), 0.0, -sin(heading), 0.0, 1.0, 0.0, sin(heading), 0.0, cos(heading));
            vec3 world = center + orbit + rot * (p * 1.5 * uScale);
            vec4 mv = viewMatrix * vec4(world, 1.0);
            vDist = -mv.z;
            vTip = aWing;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uFog;
          uniform float uFogNear;
          uniform float uFogFar;
          uniform float uLight;
          varying float vDist;
          varying float vTip;
          void main() {
            vec3 col = mix(vec3(0.92, 0.92, 0.9), vec3(0.18, 0.18, 0.2), vTip * 0.8) * (0.35 + 0.65 * uLight);
            col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vDist));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    m.visible = env.birds > 0.03;
    material.uniforms.uScale.value = env.birds;
  });

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
