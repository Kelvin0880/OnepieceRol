import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import type { Group, Material, ShaderMaterial } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { BufferGeometry } from "three";
import { presence } from "../lib/voyage";
import { voyage } from "./store";

/** Shows a landmark only around its stop of the voyage and fades its materials in and out of the mist. */
export function useFade(group: RefObject<Group | null>, materials: Material[], center: number, before: number, after: number, onFrame?: (vis: number, t: number) => void) {
  useFrame((state) => {
    const vis = presence(voyage.current, center, before, after);
    const g = group.current;
    if (!g) return;
    g.visible = vis > 0.04;
    if (!g.visible) return;
    for (const m of materials) {
      const shader = m as ShaderMaterial;
      if (shader.uniforms?.uVis) shader.uniforms.uVis.value = vis;
      else {
        m.opacity = vis;
        m.transparent = vis < 0.999;
      }
    }
    onFrame?.(vis, state.clock.elapsedTime);
  });
}

export function merge(parts: BufferGeometry[]): BufferGeometry {
  const ready = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    g.deleteAttribute("uv");
    g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(ready, false);
  if (!merged) throw new Error("could not merge landmark geometry");
  return merged;
}
