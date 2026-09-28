import { motion, useMotionValueEvent } from "motion/react";
import { lazy, Suspense, useRef, useState } from "react";
import { sampleEnv, toCss } from "../lib/env";
import { pickTier, type Tier } from "../lib/quality";
import { param } from "../lib/scroll";
import { voyageMV } from "../hooks/useVoyage";

const SceneCanvas = lazy(() => import("../three/SceneCanvas"));

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function detectTier(): Tier | "none" {
  const forced = param("tier");
  if (forced === "none" || forced === "low" || forced === "medium" || forced === "high") return forced;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return pickTier({
    webgl: hasWebGL(),
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    width: window.innerWidth,
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    saveData: nav.connection?.saveData,
  });
}

/** The painted sky behind everything when there is no 3D (or while it loads): same colours as the scene, driven by the same voyage. */
function CssSea() {
  const ref = useRef<HTMLDivElement>(null);
  const paint = (v: number) => {
    const el = ref.current;
    if (!el) return;
    const env = sampleEnv(v);
    el.style.setProperty("--top", toCss(env.skyTop));
    el.style.setProperty("--horizon", toCss(env.skyHorizon));
    el.style.setProperty("--fog", toCss(env.fog));
    el.style.setProperty("--deep", toCss(env.deep));
    el.style.setProperty("--sun", toCss(env.sun));
  };
  useMotionValueEvent(voyageMV, "change", paint);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        paint(voyageMV.get());
      }}
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 60% 22% at 38% 57%, color-mix(in srgb, var(--sun) 55%, transparent), transparent 70%), linear-gradient(180deg, var(--top) 0%, var(--horizon) 56%, var(--fog) 58%, var(--deep) 72%, #04080e 100%)",
      }}
    />
  );
}

export function SceneLayer() {
  const [tier] = useState(detectTier);
  const [ready, setReady] = useState(false);
  // The painted sky stays underneath: if the 3D is slow, missing or not composited, the visitor still sees a sky.
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden data-scene={tier} data-ready={ready}>
      <CssSea />
      {tier !== "none" && (
        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={{ duration: 1.6, ease: "easeOut" }}>
          <Suspense fallback={null}>
            <SceneCanvas initialTier={tier} onReady={() => setReady(true)} />
          </Suspense>
        </motion.div>
      )}
    </div>
  );
}
