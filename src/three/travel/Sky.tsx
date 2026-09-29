// Ported verbatim from landing/src/three/Sky.tsx (2026-09-29) — no changes needed, imports already match this
// module's flat layout.
"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from "three";
import { NOISE_GLSL, OUTPUT_GLSL, SKY_GRADIENT_GLSL, SKY_UNIFORMS_GLSL } from "./glsl";
import { U } from "./uniforms";

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}
`;

const fragmentShader = /* glsl */ `
${SKY_UNIFORMS_GLSL}
uniform float uClouds;
uniform vec3 uCloudColor;
uniform float uStars;
uniform float uLight;
varying vec3 vDir;
${NOISE_GLSL}
${SKY_GRADIENT_GLSL}

void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyGradient(d);
  float sd = max(dot(d, uSunDir), 0.0);
  float up = smoothstep(-0.1, 0.02, uSunDir.y);
  col += uSunColor * uSunIntensity * up * (smoothstep(0.99955, 0.99975, sd) * 14.0 + pow(sd, 350.0) * 2.5);

  float cover = 0.0;
  if (d.y > -0.02) {
    vec2 uv = d.xz / (max(d.y, 0.0) + 0.16) * 1.35 + vec2(uTime * 0.01, uTime * 0.0035);
    float n = fbm(uv * 0.85);
    cover = smoothstep(0.66 - 0.34 * uClouds, 0.98 - 0.22 * uClouds, n) * smoothstep(-0.02, 0.2, d.y) * min(1.0, uClouds * 1.15);
    float rim = pow(sd, 5.0) * up;
    vec3 cloud = mix(uCloudColor * (0.55 + 0.25 * uLight), uCloudColor, smoothstep(0.4, 0.9, n)) + uSunColor * rim * 0.9 * uSunIntensity;
    col = mix(col, cloud, cover * 0.9);

    vec3 sp = d * 420.0;
    vec3 cell = floor(sp);
    float h = hash13(cell);
    float star = step(0.9955, h) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
    star *= 0.55 + 0.45 * sin(uTime * 1.7 + h * 60.0);
    col += vec3(0.95, 0.97, 1.0) * star * uStars * (1.0 - cover) * smoothstep(0.04, 0.3, d.y) * 1.6;
  }
  col += uFlash * vec3(0.55, 0.62, 0.88) * (0.2 + 0.8 * cover + 0.3 * smoothstep(-0.1, 0.5, d.y));
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT_GLSL}
}
`;

export function Sky() {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => new SphereGeometry(900, 48, 24), []);
  const material = useMemo(
    () => new ShaderMaterial({ uniforms: { ...U }, vertexShader, fragmentShader, side: BackSide, depthWrite: false, fog: false }),
    [],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-2} />;
}
