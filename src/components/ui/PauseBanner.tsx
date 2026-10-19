"use client";

import { useEffect, useState } from "react";
import { PAUSED_MESSAGE } from "@/lib/engine/pause";

/** Thin bar shown on every page while the owner has the game paused. */
export default function PauseBanner() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/pause", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setPaused(d.paused === true))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!paused) return null;
  return (
    <div role="status" data-testid="pause-banner" className="relative z-20 border-b border-line bg-[#2a1d0c] px-4 py-2 text-center text-sm text-[#f0c36a]">
      ⏸ {PAUSED_MESSAGE}
    </div>
  );
}
