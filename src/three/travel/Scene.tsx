// New (2026-09-29): a trimmed World-equivalent — ocean + ship + sky + lighting only, no birds/landmarks/
// rain/lightning/postprocessing. Driven by a time-based clip progress (see lib/path.ts, lib/rig.ts) instead
// of landing's scroll position. Default export so `next/dynamic` can lazy-load it.
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { ACESFilmicToneMapping, DirectionalLight, Fog, Group, HemisphereLight, PointLight, Vector3 } from "three";
import type { Env } from "./lib/env";
import { sampleRig } from "./lib/rig";
import { shipPosition } from "./lib/path";
import { waveHeight, waveNormal } from "./lib/waves";
import { SETTINGS } from "./lib/quality";
import { Ocean } from "./Ocean";
import { Ship } from "./Ship";
import { Sky } from "./Sky";
import { syncUniforms, U } from "./uniforms";

/** Reports ready only once real frames are on screen: the first one also compiles every shader. */
function ReadyAfterFrames({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) onReady();
  });
  return null;
}

function Rig({ env, durationSec }: { env: Env; durationSec: number }) {
  const { scene, camera, size } = useThree();
  const ship = useRef<Group>(null);
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const deckLight = useRef<PointLight>(null);
  const tmp = useMemo(() => ({ cam: [0, 0, 0] as [number, number, number], look: [0, 0, 0] as [number, number, number], target: new Vector3() }), []);

  useEffect(() => {
    scene.fog = new Fog("#7a8fae", 30, 220);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = Math.min(1, t / durationSec);
    syncUniforms(env, t, 0);

    const track = shipPosition(p);
    const yaw = Math.atan2(-track.dx, -track.dz);
    const h = waveHeight(track.x, track.z, t, env.rough);
    const n = waveNormal(track.x, track.z, t, env.rough);
    U.uShip.value.set(track.x, track.z, yaw);
    if (ship.current) {
      ship.current.position.set(track.x, h * 0.72 - 0.2, track.z);
      const tilt = (a: number) => Math.max(-0.22, Math.min(0.22, a * 0.65));
      ship.current.rotation.set(tilt(n[2]), yaw, tilt(-n[0]), "YXZ");
    }

    tmp.cam.fill(0);
    tmp.look.fill(0);
    sampleRig(p, size.width / Math.max(1, size.height), tmp.cam, tmp.look);
    camera.position.set(track.x + tmp.cam[0], Math.max(1.2, tmp.cam[1] + h * 0.25), track.z + tmp.cam[2]);
    tmp.target.set(track.x + tmp.look[0], tmp.look[1], track.z + tmp.look[2]);
    camera.lookAt(tmp.target);

    const fog = scene.fog as Fog | null;
    if (fog) {
      fog.color.setRGB(env.fog[0], env.fog[1], env.fog[2]);
      fog.near = env.fogNear;
      fog.far = env.fogFar;
    }
    if (hemi.current) {
      hemi.current.color.setRGB(env.skyTop[0] * 0.6 + env.skyHorizon[0] * 0.4, env.skyTop[1] * 0.6 + env.skyHorizon[1] * 0.4, env.skyTop[2] * 0.6 + env.skyHorizon[2] * 0.4);
      hemi.current.groundColor.setRGB(env.deep[0], env.deep[1], env.deep[2]);
      hemi.current.intensity = 0.55 + env.light * 1.1;
    }
    if (sun.current) {
      sun.current.position.set(track.x + env.sunDir[0] * 120, Math.max(8, env.sunDir[1] * 120), track.z + env.sunDir[2] * 120);
      sun.current.target.position.set(track.x, 0, track.z);
      sun.current.target.updateMatrixWorld();
      sun.current.color.setRGB(env.sun[0], env.sun[1], env.sun[2]);
      sun.current.intensity = env.sunIntensity * 2.2 * Math.max(0.25, env.light);
    }
    if (deckLight.current && ship.current) {
      deckLight.current.position.set(track.x, ship.current.position.y + 2.6, track.z + 2.6);
      deckLight.current.intensity = (1 - env.light) * 9;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#9fb8d8", "#0b2a44", 1]} />
      <directionalLight ref={sun} args={["#ffd7a0", 2]} />
      <pointLight ref={deckLight} args={["#ffb060", 0, 14, 1.6]} />
      <Sky />
      <Ocean radial={SETTINGS.oceanRadial} rings={SETTINGS.oceanRings} />
      <Ship ref={ship} />
    </>
  );
}

export default function Scene({ env, durationSec, onReady }: { env: Env; durationSec: number; onReady: () => void }) {
  return (
    <Canvas
      dpr={SETTINGS.dpr}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false, toneMapping: ACESFilmicToneMapping }}
      camera={{ fov: 50, near: 0.3, far: 400, position: [-14, 5, 6] }}
    >
      <ReadyAfterFrames onReady={onReady} />
      <Rig env={env} durationSec={durationSec} />
    </Canvas>
  );
}
