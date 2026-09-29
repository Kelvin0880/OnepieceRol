// New (2026-09-29): the lazy entry point for the "zarpando" cinematic. `next/dynamic(..., { ssr: false })`
// (not React.lazy — this app is Next.js App Router with SSR, unlike landing's plain Vite SPA) guarantees the
// WebGL-touching Scene never enters a server render pass. Owns tier/WebGL detection (decided once at mount,
// never mid-clip — see lib/quality.ts), the reduced-motion short-circuit, the skip control, and the
// auto-advance timer. See CLAUDE.md's "3D zarpando cinematic" entry for the full design context.
"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { pickMood } from "./lib/env";
import { pickTier } from "./lib/quality";
import CssFallback from "./CssFallback";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

export type TravelKind = "hop" | "depart" | "arrive";

const DURATION_MS: Record<TravelKind, number> = {
  hop: 4000,
  depart: 5500,
  arrive: 4000,
};

// Respecting the OS's reduced-motion preference means not making the player sit through even a static-gradient
// hold for the full clip length — just a brief, non-animated beat so the transition doesn't feel abrupt.
const REDUCED_MOTION_MS = 350;

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function detectTier(): "on" | "off" {
  if (typeof window === "undefined") return "off";
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

function detectReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function TravelCinematic({
  kind,
  island,
  onDone,
  holdFor,
}: {
  kind: TravelKind;
  island: { name: string; sea: string; dangerLevel: number };
  onDone: () => void;
  /** Optional: don't actually call `onDone` until this settles too (e.g. the travel request's response), so a
   * slow network never reveals stale data — but the clip's own minimum length is never skipped either. */
  holdFor?: Promise<unknown>;
}) {
  const [tier] = useState(detectTier);
  const [reducedMotion] = useState(detectReducedMotion);
  const [ready, setReady] = useState(false);
  const doneRef = useRef(onDone);
  const holdForRef = useRef(holdFor);
  const firedRef = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
    holdForRef.current = holdFor;
  }, [onDone, holdFor]);

  const env = useMemo(() => pickMood(island.sea, island.name, island.dangerLevel), [island.sea, island.name, island.dangerLevel]);
  const durationMs = reducedMotion ? REDUCED_MOTION_MS : DURATION_MS[kind];

  const finish = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    const hold = holdForRef.current;
    if (hold) hold.catch(() => {}).finally(() => doneRef.current());
    else doneRef.current();
  };

  useEffect(() => {
    const t = setTimeout(finish, durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  return (
    <div
      className="fixed inset-0 z-[60] cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label="Saltar animación de viaje"
      onClick={finish}
      data-testid="travel-cinematic"
      data-kind={kind}
      data-scene={tier}
      data-ready={reducedMotion ? "true" : String(ready)}
    >
      <CssFallback env={env} />
      {tier === "on" && !reducedMotion && (
        <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }}>
          <Suspense fallback={null}>
            <Scene env={env} durationSec={durationMs / 1000} onReady={() => setReady(true)} />
          </Suspense>
        </div>
      )}
      <button
        type="button"
        className="absolute bottom-6 right-4 sm:right-6 rounded border border-gold/50 bg-black/40 px-3 py-1.5 text-xs text-gold-bright backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        data-testid="travel-cinematic-skip"
      >
        Saltar
      </button>
    </div>
  );
}
