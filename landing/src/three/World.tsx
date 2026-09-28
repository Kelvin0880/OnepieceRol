import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, DirectionalLight, Fog, Group, HemisphereLight, PointLight, Vector3 } from "three";
import { sampleEnv } from "../lib/env";
import type { TierSettings } from "../lib/quality";
import { waveHeight, waveNormal } from "../lib/waves";
import { Birds } from "./Birds";
import { Landmarks } from "./Landmarks";
import { Lightning } from "./Lightning";
import { Ocean } from "./Ocean";
import { Rain } from "./Rain";
import { sampleRig } from "./rig";
import { Ship } from "./Ship";
import { Sky } from "./Sky";
import { env, flash, pointer, shipTrack, voyage } from "./store";
import { syncUniforms, U } from "./uniforms";

const damp = (from: number, to: number, lambda: number, dt: number) => from + (to - from) * (1 - Math.exp(-lambda * dt));

export function World({ settings }: { settings: TierSettings }) {
  const { scene, camera, size } = useThree();
  const ship = useRef<Group>(null);
  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const deckLight = useRef<PointLight>(null);
  const smoothPointer = useRef({ x: 0, y: 0 });
  const tmp = useMemo(() => ({ cam: [0, 0, 0] as [number, number, number], look: [0, 0, 0] as [number, number, number], target: new Vector3(), c: new Color() }), []);

  useEffect(() => {
    scene.fog = new Fog("#e9c29a", 45, 230);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    // A looser cap than the rest of the frame: on a slow device the sea should still keep up with the scroll.
    voyage.current = damp(voyage.current, voyage.target, 2.4, Math.min(delta, 0.12));
    const v = voyage.current;
    sampleEnv(v, env);
    syncUniforms(env, t, flash.value);

    const track = shipTrack(v);
    const yaw = Math.atan2(-track.dx, -track.dz);
    const h = waveHeight(track.x, track.z, t, env.rough);
    const n = waveNormal(track.x, track.z, t, env.rough);
    U.uShip.value.set(track.x, track.z, yaw);
    if (ship.current) {
      ship.current.position.set(track.x, h * 0.72 - 0.2, track.z);
      const tilt = (a: number) => Math.max(-0.22, Math.min(0.22, a * 0.65));
      ship.current.rotation.set(tilt(n[2]), yaw, tilt(-n[0]), "YXZ");
    }

    smoothPointer.current.x = damp(smoothPointer.current.x, pointer.x, 3, dt);
    smoothPointer.current.y = damp(smoothPointer.current.y, pointer.y, 3, dt);
    tmp.cam.fill(0);
    tmp.look.fill(0);
    sampleRig(v, size.width / Math.max(1, size.height), tmp.cam, tmp.look);
    const sway = Math.sin(t * 0.37) * 0.35;
    camera.position.set(
      track.x + tmp.cam[0] + smoothPointer.current.x * 1.6 + sway,
      Math.max(1.2, tmp.cam[1] + smoothPointer.current.y * 0.9 + Math.sin(t * 0.52) * 0.22 + h * 0.25),
      track.z + tmp.cam[2],
    );
    tmp.target.set(track.x + tmp.look[0], tmp.look[1], track.z + tmp.look[2]);
    camera.lookAt(tmp.target);

    const fog = scene.fog as Fog | null;
    if (fog) {
      fog.color.setRGB(env.fog[0], env.fog[1], env.fog[2]);
      fog.near = env.fogNear;
      fog.far = env.fogFar;
    }
    const f = flash.value;
    if (hemi.current) {
      hemi.current.color.setRGB(env.skyTop[0] * 0.6 + env.skyHorizon[0] * 0.4, env.skyTop[1] * 0.6 + env.skyHorizon[1] * 0.4, env.skyTop[2] * 0.6 + env.skyHorizon[2] * 0.4);
      hemi.current.groundColor.setRGB(env.deep[0], env.deep[1], env.deep[2]);
      hemi.current.intensity = 0.55 + env.light * 1.1 + f * 2.5;
    }
    if (sun.current) {
      sun.current.position.set(track.x + env.sunDir[0] * 120, Math.max(8, env.sunDir[1] * 120), track.z + env.sunDir[2] * 120);
      sun.current.target.position.set(track.x, 0, track.z);
      sun.current.target.updateMatrixWorld();
      sun.current.color.setRGB(env.sun[0], env.sun[1], env.sun[2]);
      sun.current.intensity = env.sunIntensity * 2.2 * Math.max(0.25, env.light) + f * 3;
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
      <Ocean radial={settings.oceanRadial} rings={settings.oceanRings} />
      <Ship ref={ship} />
      <Birds />
      <Landmarks settings={settings} />
      <Rain count={settings.rain} />
      <Lightning />
    </>
  );
}
