import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useState } from "react";
import { voyageMV } from "../hooks/useVoyage";
import { scrollToId } from "../lib/scroll";
import { MAX_SEA, SEA_STOPS, stopIndexAt } from "../lib/voyage";

/** The route on the right edge (desktop) and a thin progress line on phones, both following the same voyage as the 3D sea. */
export function RouteIndicator() {
  const [current, setCurrent] = useState(0);
  useMotionValueEvent(voyageMV, "change", (v) => setCurrent(stopIndexAt(v)));
  const shipTop = useTransform(voyageMV, (v) => `${(Math.min(MAX_SEA, Math.max(0, v)) / MAX_SEA) * 100}%`);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });

  return (
    <>
      <motion.div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-gold-deep via-gold-bright to-gold min-[1400px]:hidden" style={{ scaleX: progress }} />
      <nav aria-label="Ruta del viaje" className="fixed top-1/2 right-6 z-30 hidden -translate-y-1/2 min-[1400px]:block" data-testid="route">
        <div className="relative flex h-[22rem] flex-col items-end justify-between">
          <div aria-hidden className="rope absolute top-1 right-[7px] bottom-1 w-[2px] rounded-full opacity-70" />
          <motion.div aria-hidden className="absolute right-[1px] -translate-y-1/2" style={{ top: shipTop }}>
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-gold-bright drop-shadow-[0_0_6px_rgba(240,200,105,0.9)]">
              <path d="M8 1v9M3 10h10l-2 4H5z M8 2l5 6H8z" />
            </svg>
          </motion.div>
          {SEA_STOPS.map((stop, i) => (
            <button
              key={stop.id}
              type="button"
              onClick={() => scrollToId(stop.section)}
              className="group relative flex items-center gap-3 pr-6"
              aria-current={current === i ? "step" : undefined}
            >
              <span className={`absolute right-[3px] h-2.5 w-2.5 rounded-full border transition-colors duration-500 ${current >= i ? "border-gold-bright bg-gold" : "border-gold/50 bg-abyss"}`} />
              <span
                className={`font-display text-[0.62rem] tracking-[0.22em] whitespace-nowrap uppercase transition-all duration-500 ${
                  current === i ? "translate-x-0 text-gold-bright opacity-100" : "translate-x-1 text-ink-dim opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                }`}
              >
                {stop.name}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
