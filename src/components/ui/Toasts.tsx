"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { DeltaToast } from "@/lib/ui/format";
import { SPRING } from "@/components/motion/presets";

interface LiveToast extends DeltaToast {
  id: number;
}

const TONE: Record<DeltaToast["tone"], string> = {
  gold: "border-gold text-gold-bright",
  blood: "border-blood text-[#f0907a]",
  jade: "border-jade text-jade",
};

let seq = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const push = useCallback((items: DeltaToast[]) => {
    if (items.length === 0) return;
    const live = items.slice(0, 4).map((t) => ({ ...t, id: ++seq }));
    setToasts((cur) => [...cur, ...live].slice(-5));
    for (const t of live) setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), t.kind === "level" || t.kind === "rank" ? 4200 : 2400);
  }, []);
  return { toasts, push };
}

// Small toasts slide in from the edge and float away; a level-up or a promotion swings in in 3D like a medal
// being turned over, with a shine across it.
export function ToastStack({ toasts }: { toasts: LiveToast[] }) {
  return (
    <div
      className="fixed z-[60] right-3 sm:right-6 flex flex-col items-end gap-2 pointer-events-none"
      style={{ top: "calc(var(--play-header-h, 3.5rem) + 0.5rem)" }}
      aria-live="polite"
      data-testid="toast-stack"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) =>
          t.kind === "level" || t.kind === "rank" ? (
            <m.div
              key={t.id}
              className="panel panel-accent shine-sweep px-4 py-2.5 font-display text-lg text-gold-bright shadow-2xl"
              data-testid="toast-big"
              style={{ transformPerspective: 600 }}
              initial={{ opacity: 0, rotateY: -95, scale: 0.6 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.9, transition: { duration: 0.25 } }}
              transition={{ ...SPRING.bouncy, opacity: { duration: 0.15 } }}
            >
              ✦ {t.text}
            </m.div>
          ) : (
            <m.div
              key={t.id}
              className={`rounded-full border bg-sea-deep/90 px-3 py-1 text-sm font-display ${TONE[t.tone]}`}
              data-testid="toast"
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, transition: { duration: 0.35 } }}
              transition={SPRING.snappy}
            >
              {t.text}
            </m.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
