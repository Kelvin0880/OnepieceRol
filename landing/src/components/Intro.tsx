import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

export const INTRO_SECONDS = 1.7;

/** A Log Pose needle searching for its island, then the curtain lifts. Skipped with reduced motion. */
export function Intro({ enabled }: { enabled: boolean }) {
  const [show, setShow] = useState(enabled);
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => setShow(false), INTRO_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [enabled]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          aria-hidden
          className="fixed inset-0 z-[70] grid place-items-center bg-abyss"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="flex flex-col items-center gap-5">
            <div className="relative h-24 w-24 rounded-full border border-gold/50 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.18),rgba(212,169,74,0.06)_55%,transparent_70%)] shadow-[0_0_40px_rgba(212,169,74,0.25)]">
              <motion.div
                className="absolute top-1/2 left-1/2 h-[70%] w-[3px] -translate-x-1/2 -translate-y-1/2"
                initial={{ rotate: -140 }}
                animate={{ rotate: [-140, 220, 150, 180, 172] }}
                transition={{ duration: 1.3, ease: "easeOut" }}
              >
                <span className="block h-1/2 w-full rounded-full bg-blood" />
                <span className="block h-1/2 w-full rounded-full bg-ink-dim" />
              </motion.div>
              <span className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" />
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="font-display text-[0.65rem] tracking-[0.4em] text-gold uppercase">
              Leyendo el Log Pose
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
