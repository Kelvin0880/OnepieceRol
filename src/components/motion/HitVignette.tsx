"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { hitFlashStrength } from "@/lib/ui/motion";

// The screen edges flash red when your life drops, and stay faintly red while you are badly hurt. Opacity-only
// animation on one fixed layer, so it costs the phone next to nothing.
export default function HitVignette({ hp, maxHp }: { hp: number; maxHp: number }) {
  const prev = useRef(hp);
  const [flash, setFlash] = useState<{ id: number; strength: number } | null>(null);

  useEffect(() => {
    const strength = hitFlashStrength(prev.current, hp, maxHp);
    prev.current = hp;
    if (strength > 0) setFlash((f) => ({ id: (f?.id ?? 0) + 1, strength }));
  }, [hp, maxHp]);

  const critical = maxHp > 0 && hp > 0 && hp / maxHp <= 0.25;

  return (
    <>
      {critical && <div className="hit-vignette hit-vignette-critical" aria-hidden data-testid="low-life-vignette" />}
      <AnimatePresence>
        {flash && (
          <m.div
            key={flash.id}
            className="hit-vignette"
            aria-hidden
            data-testid="hit-vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, flash.strength, 0] }}
            transition={{ duration: 0.75, times: [0, 0.12, 1], ease: "easeOut" }}
            onAnimationComplete={() => setFlash((f) => (f?.id === flash.id ? null : f))}
          />
        )}
      </AnimatePresence>
    </>
  );
}
