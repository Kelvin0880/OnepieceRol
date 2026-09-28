import { animate, useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatBerries } from "../lib/bounty";

/** Counts up from zero the first time it is seen; the final number is in the DOM from the start for screen readers and no-JS. */
export function NumberTicker({ value, duration = 2.2, className }: { value: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.8 });
  const mv = useMotionValue(0);
  const [shown, setShown] = useState<number | null>(null);
  useMotionValueEvent(mv, "change", (v) => setShown(Math.round(v)));
  useEffect(() => {
    if (!seen) return;
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [seen, value, duration, mv]);
  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`} aria-label={formatBerries(value)}>
      <span aria-hidden>{formatBerries(shown ?? (seen ? 0 : value))}</span>
    </span>
  );
}
