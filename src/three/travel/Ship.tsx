// Ported verbatim from landing/src/three/Ship.tsx (2026-09-29), only the import path for `U` follows this
// module's own layout — no visual changes.
"use client";

import { forwardRef, useEffect, useMemo } from "react";
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  BoxGeometry,
} from "three";
import { makeEmblemTexture, makeHull, makeJib, makeRail, makeSail } from "./shipParts";
import { U } from "./uniforms";

type Variant = "hero" | "dark";

const PALETTES = {
  hero: { deck: "#b98a57", side: "#5a3a22", stripe: "#c8963a", bottom: "#4a1b15", wood: "#6b4a2b", cloth: "#f1e4c6", ink: "#1b1510", flag: "#111", flagInk: "#f1e4c6", lantern: "#ffb347", gold: "#d4a94a" },
  dark: { deck: "#2a2420", side: "#17151a", stripe: "#7a1616", bottom: "#0d0b0c", wood: "#241c18", cloth: "#1c1b1f", ink: "#8e1b1b", flag: "#0b0b0c", flagInk: "#b3261e", lantern: "#ff4a2a", gold: "#6d5a3a" },
};

/** Adds a flutter to cloth in the vertex shader; `pinned` says which edge is tied (the flag hangs from its mast edge). */
function flutter(material: MeshStandardMaterial, amount: number, pinned: "frame" | "left"): MeshStandardMaterial {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    const weight = pinned === "left" ? "uv.x" : "sin(3.14159 * uv.x) * sin(3.14159 * uv.y)";
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float w = ${weight};
        transformed.z += (sin(uTime * 3.4 + position.y * 2.1 + position.x * 1.3) * 0.6 + sin(uTime * 5.7 + position.x * 3.0) * 0.4) * ${amount.toFixed(3)} * w;`,
      );
  };
  return material;
}

function shroudLines(): BufferGeometry {
  const p: number[] = [];
  const add = (a: number[], b: number[]) => p.push(...a, ...b);
  for (const s of [-1, 1]) {
    add([0, 6.9, 0.3], [s * 1.12, 0.95, 1.1]);
    add([0, 6.9, 0.3], [s * 1.12, 0.95, -0.4]);
    add([0, 5.6, -2.0], [s * 0.95, 0.95, -1.4]);
    add([0, 5.6, -2.0], [s * 0.8, 0.95, -2.6]);
  }
  add([0, 7.1, 0.3], [0, 5.7, -2.0]);
  add([0, 5.7, -2.0], [0, 1.75, -5.55]);
  add([0, 7.1, 0.3], [0, 1.9, 3.1]);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  return g;
}

export const Ship = forwardRef<Group, { variant?: Variant; scale?: number }>(function Ship({ variant = "hero", scale = 1 }, ref) {
  const parts = useMemo(() => {
    const pal = PALETTES[variant];
    const hull = makeHull(pal);
    const hullMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
    const wood = new MeshStandardMaterial({ color: pal.wood, roughness: 0.9 });
    const gold = new MeshStandardMaterial({ color: pal.gold, metalness: 0.75, roughness: 0.35 });
    const emblem = makeEmblemTexture({ cloth: pal.cloth, ink: pal.ink, wear: true });
    const flagTex = makeEmblemTexture({ cloth: pal.flag, ink: pal.flagInk, size: 256 });
    const clothBase = { color: "#ffffff", roughness: 1, side: DoubleSide, emissive: variant === "hero" ? "#241c12" : "#120808" } as const;
    const mainSailMat = flutter(new MeshStandardMaterial({ ...clothBase, map: emblem }), 0.06, "frame");
    const sailMat = flutter(new MeshStandardMaterial({ ...clothBase, color: pal.cloth }), 0.05, "frame");
    const flagMat = flutter(new MeshStandardMaterial({ map: flagTex, side: DoubleSide, roughness: 1 }), 0.16, "left");
    const lantern = new MeshStandardMaterial({ color: pal.lantern, emissive: pal.lantern, emissiveIntensity: 5, toneMapped: false });
    const windowMat = new MeshStandardMaterial({ color: "#ffcf7a", emissive: pal.lantern, emissiveIntensity: 2.4, toneMapped: false });
    const rope = new LineBasicMaterial({ color: variant === "hero" ? "#2a1d12" : "#050505", transparent: true, opacity: 0.8 });
    const geo = {
      hull,
      railL: makeRail(1),
      railR: makeRail(-1),
      mainMast: new CylinderGeometry(0.1, 0.14, 6.8, 8),
      foreMast: new CylinderGeometry(0.09, 0.12, 5.3, 8),
      yard: new CylinderGeometry(0.055, 0.055, 1, 6),
      bowsprit: new CylinderGeometry(0.06, 0.1, 2.6, 6),
      mainSail: makeSail(3.6, 3.1, 0.55),
      topSail: makeSail(2.9, 1.6, 0.35),
      foreSail: makeSail(3.0, 2.5, 0.45),
      foreTop: makeSail(2.3, 1.3, 0.3),
      jib: makeJib(),
      flag: new PlaneGeometry(1.35, 0.85, 12, 6),
      cabin: new BoxGeometry(1.9, 1.0, 1.7),
      cabinRoof: new BoxGeometry(2.1, 0.12, 1.9),
      windowPane: new BoxGeometry(0.28, 0.24, 0.04),
      lantern: new SphereGeometry(0.12, 12, 8),
      nest: new CylinderGeometry(0.42, 0.34, 0.32, 12, 1, true),
      figure: new SphereGeometry(0.26, 16, 12),
      halo: new TorusGeometry(0.34, 0.05, 8, 20),
      shrouds: shroudLines(),
    };
    return { geo, mat: { hullMat, wood, gold, mainSailMat, sailMat, flagMat, lantern, windowMat, rope }, tex: [emblem, flagTex] };
  }, [variant]);

  useEffect(
    () => () => {
      Object.values(parts.geo).forEach((g) => g.dispose());
      Object.values(parts.mat).forEach((m) => m.dispose());
      parts.tex.forEach((t) => t.dispose());
    },
    [parts],
  );

  const { geo, mat } = parts;
  const yard = (y: number, z: number, len: number) => <mesh geometry={geo.yard} material={mat.wood} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]} scale={[1, len, 1]} />;

  return (
    <group ref={ref} scale={scale}>
      <mesh geometry={geo.hull} material={mat.hullMat} />
      <mesh geometry={geo.railL} material={mat.wood} />
      <mesh geometry={geo.railR} material={mat.wood} />
      <mesh geometry={geo.mainMast} material={mat.wood} position={[0, 4.05, 0.3]} />
      <mesh geometry={geo.foreMast} material={mat.wood} position={[0, 3.4, -2.0]} />
      <mesh geometry={geo.nest} material={mat.wood} position={[0, 5.95, 0.3]} />
      <mesh geometry={geo.bowsprit} material={mat.wood} position={[0, 1.35, -4.35]} rotation={[-1.2, 0, 0]} />
      {yard(5.45, 0.3, 3.9)}
      {yard(2.35, 0.3, 3.9)}
      {yard(6.85, 0.3, 3.1)}
      {yard(4.55, -2.0, 3.2)}
      {yard(2.05, -2.0, 3.2)}
      <mesh geometry={geo.mainSail} material={mat.mainSailMat} position={[0, 3.9, 0.35]} />
      <mesh geometry={geo.topSail} material={mat.sailMat} position={[0, 6.1, 0.35]} />
      <mesh geometry={geo.foreSail} material={mat.sailMat} position={[0, 3.3, -1.95]} />
      <mesh geometry={geo.foreTop} material={mat.sailMat} position={[0, 5.2, -1.95]} />
      <mesh geometry={geo.jib} material={mat.sailMat} position={[0, 1.45, -2.25]} />
      <mesh geometry={geo.flag} material={mat.flagMat} position={[0, 7.45, 0.3 - 0.7]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geo.cabin} material={mat.hullMat} position={[0, 1.42, 2.35]} />
      <mesh geometry={geo.cabinRoof} material={mat.wood} position={[0, 1.97, 2.35]} />
      {[-0.55, 0, 0.55].map((x) => (
        <mesh key={x} geometry={geo.windowPane} material={mat.windowMat} position={[x, 1.45, 3.21]} />
      ))}
      {[-0.82, 0.82].map((x) => (
        <mesh key={x} geometry={geo.lantern} material={mat.lantern} position={[x, 2.25, 3.15]} />
      ))}
      <mesh geometry={geo.figure} material={mat.gold} position={[0, 1.22, -3.72]} />
      <mesh geometry={geo.halo} material={mat.gold} position={[0, 1.22, -3.72]} />
      <lineSegments geometry={geo.shrouds} material={mat.rope} />
    </group>
  );
});
