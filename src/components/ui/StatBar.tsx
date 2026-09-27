"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { percent } from "@/lib/ui/format";
import { barDelta, isBigHit, type BarReading } from "@/lib/ui/motion";

interface Floater {
  id: number;
  n: number;
}

let floaterSeq = 0;

// A fighting-game style bar: it fills on first sight; when the value drops a pale "ghost" of the old value
// lingers and then drains, the change floats up as a number ("-12", "+30"), and a big hit shakes the bar.
// All of it is CSS width/transform or a one-off motion element, so twenty bars on screen cost nothing idle.
export default function StatBar({
  label,
  value,
  max,
  color,
  hideNumbers = false,
  size = "md",
  testId,
  warnBelow,
}: {
  label?: string;
  value: number;
  max: number;
  color: string;
  hideNumbers?: boolean;
  size?: "sm" | "md";
  testId?: string;
  // percent at or below which the bar pulses red (life bars)
  warnBelow?: number;
}) {
  const pct = percent(value, max);
  const [ghost, setGhost] = useState(pct);
  const [hit, setHit] = useState<"none" | "small" | "big">("none");
  const [filled, setFilled] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const prev = useRef(pct);
  const prevReading = useRef<BarReading | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const d = hideNumbers ? null : barDelta(prevReading.current, { value, max });
    prevReading.current = { value, max };
    if (d !== null) setFloaters((f) => [...f.slice(-2), { id: ++floaterSeq, n: d }]);
  }, [value, max, hideNumbers]);

  useEffect(() => {
    if (pct < prev.current) {
      setHit(isBigHit(prev.current, pct) ? "big" : "small");
      const t1 = setTimeout(() => setGhost(pct), 450);
      const t2 = setTimeout(() => setHit("none"), 650);
      prev.current = pct;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prev.current = pct;
    setGhost(pct);
  }, [pct]);

  const shown = filled ? pct : 0;
  const critical = warnBelow !== undefined && pct > 0 && pct <= warnBelow;

  return (
    <div className="relative" data-testid={testId}>
      {(label || !hideNumbers) && (
        <div className="flex justify-between gap-2 text-xs text-ink-dim mb-0.5">
          <span className="truncate">{label}</span>
          {!hideNumbers && (
            <span className="relative tabular-nums shrink-0">
              <AnimatePresence>
                {floaters.map((f) => (
                  <m.span
                    key={f.id}
                    className={`float-number ${f.n < 0 ? "text-[#ff8f78]" : "text-jade"}`}
                    aria-hidden
                    initial={{ opacity: 0, y: 4, scale: 0.6 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -7, scale: [0.6, 1.3, 1, 1] }}
                    transition={{ duration: 1.3, times: [0, 0.16, 0.72, 1], ease: "easeOut" }}
                    onAnimationComplete={() => setFloaters((all) => all.filter((x) => x.id !== f.id))}
                  >
                    {f.n > 0 ? `+${f.n}` : f.n}
                  </m.span>
                ))}
              </AnimatePresence>
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className={`relative rounded-full bg-black/35 overflow-hidden ${size === "sm" ? "h-1.5" : "h-2"} ${hit === "big" ? "animate-bar-shake" : ""} ${critical ? "bar-critical" : ""}`}
        data-critical={critical || undefined}
      >
        <div className="absolute inset-y-0 left-0 bg-white/35 transition-[width] duration-700 ease-out" style={{ width: `${filled ? Math.max(pct, ghost) : 0}%` }} />
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${hit !== "none" ? "animate-hit" : ""}`}
          style={{ width: `${shown}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, white))` }}
        />
      </div>
    </div>
  );
}
