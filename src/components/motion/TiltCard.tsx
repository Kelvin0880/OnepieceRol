"use client";

import type { ReactNode } from "react";
import { m, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { tiltFromPointer } from "@/lib/ui/motion";
import { MEDIA, SPRING } from "./presets";
import { useMediaQuery } from "./useMediaQuery";

// Follows the mouse in 3D with a moving glint. Only on devices with a real hovering pointer: on phones it renders
// a plain div and attaches no listeners at all. The rotation lives on an inner element, so the outer one stays
// free for CSS entrance animations (e.g. `.stagger`) that would otherwise pin its transform.
export default function TiltCard({ children, max = 9, className = "", testId }: { children: ReactNode; max?: number; className?: string; testId?: string }) {
  const fine = useMediaQuery(MEDIA.finePointer);
  const rx = useSpring(0, SPRING.soft);
  const ry = useSpring(0, SPRING.soft);
  const gx = useMotionValue(50);
  const gy = useMotionValue(30);
  const glint = useSpring(0, { stiffness: 200, damping: 30 });
  const glintBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.28), transparent 55%)`;

  if (!fine) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-testid={testId}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const t = tiltFromPointer(x, y, r.width, r.height, max);
        rx.set(t.rotateX);
        ry.set(t.rotateY);
        gx.set((x / r.width) * 100);
        gy.set((y / r.height) * 100);
        glint.set(1);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
        glint.set(0);
      }}
    >
      <m.div className="relative h-full rounded-[inherit]" style={{ rotateX: rx, rotateY: ry, transformPerspective: 800 }}>
        {children}
        <m.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glintBg, opacity: glint }} />
      </m.div>
    </div>
  );
}
