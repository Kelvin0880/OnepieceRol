import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, Mesh, ShaderMaterial } from "three";
import { GERSTNER_GLSL } from "../lib/waves";
import { NOISE_GLSL, OUTPUT_GLSL, SKY_GRADIENT_GLSL, SKY_UNIFORMS_GLSL } from "./glsl";
import { U } from "./uniforms";

/** Rings that grow quadratically: dense where the camera looks down, sparse at the horizon where fog hides everything. */
function makeOceanGeometry(radial: number, rings: number, radius: number): BufferGeometry {
  const positions: number[] = [0, 0, 0];
  for (let i = 1; i <= rings; i++) {
    const r = radius * Math.pow(i / rings, 2.1);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      positions.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < radial; j++) index.push(0, 1 + ((j + 1) % radial), 1 + j);
  for (let i = 0; i < rings - 1; i++) {
    const a = 1 + i * radial;
    const b = 1 + (i + 1) * radial;
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      index.push(a + j, a + j2, b + j, a + j2, b + j2, b + j);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uRough;
varying vec3 vWorld;
varying vec2 vBase;
varying float vHeight;
${GERSTNER_GLSL}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec2 base = world.xz;
  float fade = 1.0 - smoothstep(90.0, 320.0, length(base - cameraPosition.xz));
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 disp = gerstner(base, uTime, uRough, tangent, binormal) * fade;
  world.xyz += disp;
  vWorld = world.xyz;
  vBase = base;
  vHeight = disp.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
${SKY_UNIFORMS_GLSL}
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uRough;
uniform float uFoam;
uniform float uFogNear;
uniform float uFogFar;
uniform float uLight;
uniform vec3 uShip;
varying vec3 vWorld;
varying vec2 vBase;
varying float vHeight;
${NOISE_GLSL}
${GERSTNER_GLSL}
${SKY_GRADIENT_GLSL}

float wakeFoam(vec2 p, float t) {
  vec2 rel = p - uShip.xy;
  float cy = cos(uShip.z);
  float sy = sin(uShip.z);
  float along = dot(rel, vec2(sy, cy));
  float side = dot(rel, vec2(cy, -sy));
  float behind = along - 3.4;
  float width = 0.7 + max(behind, 0.0) * 0.12;
  float wobble = (vnoise(vec2(behind * 0.35 - t * 0.6, 3.0)) - 0.5) * 0.9;
  float trail = smoothstep(width, width * 0.2, abs(side + wobble)) * smoothstep(-0.5, 1.0, behind) * (1.0 - smoothstep(4.0, 34.0, behind));
  float churn = vnoise(vec2(side * 2.2, behind * 0.9 - t * 2.6)) * vnoise(vec2(side * 4.1 + 7.0, behind * 2.3 - t * 3.3));
  float e = length(vec2(side / 1.3, along / 3.8));
  float hull = smoothstep(1.3, 1.03, e) * smoothstep(0.9, 1.02, e);
  float lace = vnoise(vec2(side * 3.0, along * 2.2 - t * 1.8));
  return clamp(trail * smoothstep(0.12, 0.5, churn) * 1.6 + hull * smoothstep(0.35, 0.8, lace) * 0.9, 0.0, 1.0);
}

float rippleHeight(vec2 q, float t) {
  return vnoise(q + vec2(t * 0.16, t * 0.09)) + 0.55 * vnoise(q * 2.3 + vec2(-t * 0.12, t * 0.2)) + 0.3 * vnoise(q * 5.1 + vec2(t * 0.3, -t * 0.22));
}

vec2 ripple(vec2 p, float t) {
  vec2 q = p * 1.25;
  float e = 0.06;
  float h = rippleHeight(q, t);
  return vec2(h - rippleHeight(q + vec2(e, 0.0), t), h - rippleHeight(q + vec2(0.0, e), t)) / e;
}

void main() {
  float dist = length(vWorld - cameraPosition);
  float flat_ = smoothstep(90.0, 320.0, length(vBase - cameraPosition.xz));
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  gerstner(vBase, uTime, uRough * (1.0 - flat_), tangent, binormal);
  vec3 n = normalize(cross(binormal, tangent));
  vec2 r = ripple(vBase, uTime) * 0.045 * (1.0 - smoothstep(18.0, 150.0, dist)) * (0.6 + 0.4 * uRough);
  n = normalize(vec3(n.x + r.x, n.y, n.z + r.y));

  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, n);
  R.y = abs(R.y);
  vec3 refl = skyGradient(normalize(R));

  float crest = clamp(vHeight * 0.5 + 0.45, 0.0, 1.0);
  vec3 water = mix(uDeep, uShallow, crest * 0.85);
  float back = pow(max(dot(V, -uSunDir), 0.0), 4.0) * crest * uSunIntensity;
  water += uShallow * back * 0.4;
  water *= 0.55 + 0.45 * uLight;

  vec3 col = mix(water, refl * 0.9, clamp(fres, 0.0, 1.0) * 0.85);
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(n, H), 0.0);
  float up = smoothstep(-0.08, 0.04, uSunDir.y);
  col += uSunColor * uSunIntensity * up * (pow(nh, 520.0) * 12.0 + pow(nh, 70.0) * 0.3);

  float foamMask = smoothstep(0.45, 1.15, vHeight / max(0.25, uRough));
  float foamN = vnoise(vBase * 1.7 + uTime * 0.22) * vnoise(vBase * 4.6 - uTime * 0.18);
  float streaks = smoothstep(0.35, 0.75, vnoise(vec2(vBase.x * 0.35 + vBase.y * 0.9, vBase.y * 0.25 - uTime * 0.3)));
  float foam = clamp(foamMask * smoothstep(0.22, 0.5, foamN) * (0.4 + 0.6 * streaks) * 1.25 * uFoam, 0.0, 0.7) * (1.0 - flat_);
  foam = max(foam, wakeFoam(vBase, uTime) * 0.8);
  col = mix(col, vec3(0.9, 0.95, 1.0) * (0.25 + 0.75 * uLight), foam);

  col += uFlash * vec3(0.4, 0.5, 0.78) * (0.15 + fres);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT_GLSL}
}
`;

const snap = (v: number, step: number) => Math.round(v / step) * step;

export function Ocean({ radial, rings }: { radial: number; rings: number }) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => makeOceanGeometry(radial, rings, 760), [radial, rings]);
  const material = useMemo(() => new ShaderMaterial({ uniforms: { ...U }, vertexShader, fragmentShader, fog: false }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }) => {
    ref.current?.position.set(snap(camera.position.x, 0.25), 0, snap(camera.position.z, 0.25));
  });

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />;
}
