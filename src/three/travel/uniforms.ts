// Adapted from landing/src/three/uniforms.ts (2026-09-29): dropped `uRain`/`uGlory` — neither Ocean's nor
// Sky's fragment shader here actually samples them (they only mattered to landing's Rain/Lightning/Landmarks
// components, which this trimmed scene doesn't render), so keeping them would just be dead uniforms.
import { Vector3 } from "three";
import type { Env } from "./lib/env";

/** One set of uniform objects shared by every custom shader, updated once per frame. */
export const U = {
  uTime: { value: 0 },
  uSkyTop: { value: new Vector3() },
  uSkyHorizon: { value: new Vector3() },
  uFog: { value: new Vector3() },
  uSunDir: { value: new Vector3(0, 0.2, -1) },
  uSunColor: { value: new Vector3(1, 0.9, 0.7) },
  uSunIntensity: { value: 1 },
  uFlash: { value: 0 },
  uFogNear: { value: 45 },
  uFogFar: { value: 230 },
  uDeep: { value: new Vector3() },
  uShallow: { value: new Vector3() },
  uRough: { value: 0.7 },
  uFoam: { value: 0.3 },
  uClouds: { value: 0.5 },
  uCloudColor: { value: new Vector3(1, 1, 1) },
  uStars: { value: 0 },
  uLight: { value: 1 },
  /** Ship x, z and heading, for the wake the ocean paints around the hull. */
  uShip: { value: new Vector3() },
};

export function syncUniforms(env: Env, time: number, flash: number): void {
  U.uTime.value = time;
  U.uSkyTop.value.fromArray(env.skyTop);
  U.uSkyHorizon.value.fromArray(env.skyHorizon);
  U.uFog.value.fromArray(env.fog);
  U.uSunDir.value.fromArray(env.sunDir);
  U.uSunColor.value.fromArray(env.sun);
  U.uSunIntensity.value = env.sunIntensity;
  U.uFlash.value = flash;
  U.uFogNear.value = env.fogNear;
  U.uFogFar.value = env.fogFar;
  U.uDeep.value.fromArray(env.deep);
  U.uShallow.value.fromArray(env.shallow);
  U.uRough.value = env.rough;
  U.uFoam.value = env.foam;
  U.uClouds.value = env.clouds;
  U.uCloudColor.value.fromArray(env.cloud);
  U.uStars.value = env.stars;
  U.uLight.value = env.light;
}
