import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** The player's own bar, like in the game: it slides to the new value and floats the difference beside it. */
export function StatBar({ label, value, max = 100, tone }: { label: string; value: number; max?: number; tone: "life" | "stamina" }) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (d !== 0) setDelta({ id: Date.now(), amount: d });
    const t = window.setTimeout(() => setDelta(null), 1600);
    return () => window.clearTimeout(t);
  }, [value]);
  const fill = tone === "life" ? "from-[#8f2a1b] via-blood to-[#e0704f]" : "from-[#1e4f7a] via-stamina to-[#8cc3ea]";
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2 font-display text-[0.62rem] tracking-[0.18em] text-ink-dim uppercase">
        <span>{label}</span>
        <span className="relative tabular-nums text-ink">
          {value}/{max}
          <AnimatePresence>
            {delta && (
              <motion.span
                key={delta.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: -10 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.6 }}
                className={`absolute -top-2 right-full mr-1.5 font-bold ${delta.amount < 0 ? "text-[#ff8a6a]" : "text-jade"}`}
              >
                {delta.amount > 0 ? `+${delta.amount}` : delta.amount}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/5">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${fill}`}
          initial={false}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
      </div>
    </div>
  );
}
