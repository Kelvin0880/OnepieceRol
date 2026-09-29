// New (2026-09-29): the painted-gradient fallback shown while the 3D chunk loads (or in place of it entirely
// on a low-end/no-WebGL device) — same gradient shape as landing's SceneLayer.tsx `CssSea`, driven by
// `pickMood()` directly instead of a scroll position.
"use client";

import { toCss, type Env } from "./lib/env";

export default function CssFallback({ env }: { env: Env }) {
  const top = toCss(env.skyTop);
  const horizon = toCss(env.skyHorizon);
  const fog = toCss(env.fog);
  const deep = toCss(env.deep);
  const sun = toCss(env.sun);
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(ellipse 60% 22% at 38% 57%, color-mix(in srgb, ${sun} 55%, transparent), transparent 70%), linear-gradient(180deg, ${top} 0%, ${horizon} 56%, ${fog} 58%, ${deep} 72%, #04080e 100%)`,
      }}
    />
  );
}
