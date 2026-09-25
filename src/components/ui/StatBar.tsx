"use client";

import { useEffect, useRef, useState } from "react";
import { percent } from "@/lib/ui/format";

// A fighting-game style bar: when the value drops, a pale "ghost" of the old value lingers for a moment and then
// drains, so a hit is readable at a glance.
export default function StatBar({
  label,
  value,
  max,
  color,
  hideNumbers = false,
  size = "md",
  testId,
}: {
  label?: string;
  value: number;
  max: number;
  color: string;
  hideNumbers?: boolean;
  size?: "sm" | "md";
  testId?: string;
}) {
  const pct = percent(value, max);
  const [ghost, setGhost] = useState(pct);
  const [hit, setHit] = useState(false);
  const prev = useRef(pct);

  useEffect(() => {
    if (pct < prev.current) {
      setHit(true);
      const t1 = setTimeout(() => setGhost(pct), 450);
      const t2 = setTimeout(() => setHit(false), 650);
      prev.current = pct;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prev.current = pct;
    setGhost(pct);
  }, [pct]);

  return (
    <div data-testid={testId}>
      {(label || !hideNumbers) && (
        <div className="flex justify-between gap-2 text-xs text-ink-dim mb-0.5">
          <span className="truncate">{label}</span>
          {!hideNumbers && (
            <span className="tabular-nums shrink-0">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div className={`relative rounded-full bg-black/35 overflow-hidden ${size === "sm" ? "h-1.5" : "h-2"}`}>
        <div className="absolute inset-y-0 left-0 bg-white/35 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(pct, ghost)}%` }} />
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${hit ? "animate-hit" : ""}`}
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, white))` }}
        />
      </div>
    </div>
  );
}
