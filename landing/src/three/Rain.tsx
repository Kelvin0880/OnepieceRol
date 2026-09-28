import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { env } from "./store";
import { U } from "./uniforms";

/** Streaks that wrap around the camera, animated entirely on the GPU. */
export function Rain({ count }: { count: number }) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const base = new PlaneGeometry(0.035, 1.3);
    const g = new InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.setAttribute("uv", base.getAttribute("uv"));
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < seeds.length; i++) {
      const s = Math.sin((i + 1) * 91.345) * 47453.5453;
      seeds[i] = s - Math.floor(s);
    }
    g.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 3));
    g.instanceCount = count;
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: U.uTime, uRain: U.uRain, uLight: U.uLight, uFlash: U.uFlash },
        vertexShader: /* glsl */ `
          attribute vec3 aSeed;
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            float range = 46.0;
            vec3 cam = cameraPosition;
            vec3 p;
            p.x = cam.x + mod(aSeed.x * range - cam.x + range * 0.5, range) - range * 0.5;
            p.z = cam.z + mod(aSeed.z * range - cam.z + range * 0.5, range) - range * 0.5;
            p.y = cam.y + mod(aSeed.y * 34.0 - uTime * (24.0 + aSeed.x * 8.0), 34.0) - 17.0;
            vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
            vec3 world = p + right * position.x + vec3(position.y * 0.3, position.y, 0.0);
            gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uRain;
          uniform float uLight;
          uniform float uFlash;
          varying vec2 vUv;
          void main() {
            float a = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y) * 0.32 * uRain;
            gl_FragColor = vec4(vec3(0.72, 0.8, 0.9) * (0.5 + uLight + uFlash * 2.0), a);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    if (ref.current) ref.current.visible = env.rain > 0.02;
  });
  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}
