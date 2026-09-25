"use client";

import { useCallback, useState } from "react";
import type { DeltaToast } from "@/lib/ui/format";

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

export function ToastStack({ toasts }: { toasts: LiveToast[] }) {
  return (
    <div className="fixed z-[60] top-16 right-3 sm:right-6 flex flex-col items-end gap-2 pointer-events-none" aria-live="polite" data-testid="toast-stack">
      {toasts.map((t) =>
        t.kind === "level" || t.kind === "rank" ? (
          <div key={t.id} className="panel panel-accent px-4 py-2.5 animate-pop font-display text-lg text-gold-bright shadow-2xl" data-testid="toast-big">
            ✦ {t.text}
          </div>
        ) : (
          <div key={t.id} className={`rounded-full border bg-sea-deep/90 px-3 py-1 text-sm font-display animate-float-up ${TONE[t.tone]}`} data-testid="toast">
            {t.text}
          </div>
        )
      )}
    </div>
  );
}
