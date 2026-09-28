import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useRef, useState } from "react";
import { ACESFilmicToneMapping } from "three";
import { lowerTier, TIER_SETTINGS, type Tier } from "../lib/quality";
import { param } from "../lib/scroll";
import { World } from "./World";

function Effects({ mode }: { mode: "full" | "lite" }) {
  return (
    <EffectComposer multisampling={mode === "full" ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={mode === "full" ? 0.85 : 0.65} luminanceThreshold={1.05} luminanceSmoothing={0.3} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  );
}

/** Reports ready only once real frames are on screen: the first one also compiles every shader, which can take seconds on weak GPUs. */
function ReadyAfterFrames({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) onReady();
  });
  return null;
}

export default function SceneCanvas({ initialTier, onReady }: { initialTier: Tier; onReady: () => void }) {
  const [tier, setTier] = useState<Tier>(initialTier);
  const settings = TIER_SETTINGS[tier];
  return (
    <Canvas
      dpr={settings.dpr}
      // ?capture=1 keeps the last frame for screenshots: software GL in test browsers can be caught between frames.
      gl={{ antialias: settings.postprocessing === "off", powerPreference: "high-performance", alpha: false, stencil: false, toneMapping: ACESFilmicToneMapping, preserveDrawingBuffer: param("capture") !== null }}
      camera={{ fov: 50, near: 0.3, far: 2400, position: [7.5, 3, 12.5] }}
      data-tier={tier}
    >
      <ReadyAfterFrames onReady={onReady} />
      <PerformanceMonitor flipflops={2} onDecline={() => setTier((t) => lowerTier(t))} onFallback={() => setTier("low")} />
      <World settings={settings} />
      {settings.postprocessing !== "off" && <Effects mode={settings.postprocessing} />}
    </Canvas>
  );
}
