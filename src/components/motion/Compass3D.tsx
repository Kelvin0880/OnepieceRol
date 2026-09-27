"use client";

import { m, useSpring } from "motion/react";
import { tiltFromPointer } from "@/lib/ui/motion";
import { MEDIA, SPRING } from "./presets";
import { useMediaQuery } from "./useMediaQuery";

function Rose() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" aria-hidden>
      <defs>
        <radialGradient id="c3d-face" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#1d3349" />
          <stop offset="100%" stopColor="#0b1520" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#c3d-face)" stroke="#d4a94a" strokeWidth="3" />
      <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55">
        <circle cx="100" cy="100" r="82" />
        <circle cx="100" cy="100" r="64" strokeDasharray="2 6" />
        <circle cx="100" cy="100" r="28" />
      </g>
      <g fill="currentColor">
        <path d="M100 14 L112 100 L100 186 L88 100 Z" opacity="0.9" />
        <path d="M14 100 L100 88 L186 100 L100 112 Z" opacity="0.6" />
        <path d="M40 40 L104 96 L160 160 L96 104 Z" opacity="0.25" />
        <path d="M160 40 L104 104 L40 160 L96 96 Z" opacity="0.25" />
      </g>
      <text x="100" y="32" textAnchor="middle" fontSize="14" fill="currentColor" fontFamily="serif">N</text>
    </svg>
  );
}

// The landing's centrepiece: a brass compass lying in perspective, its rose turning inside the tilted plane,
// a needle standing up and swinging, and a soft shadow on the "table". Pure CSS 3D; on desktop the whole piece
// leans toward the mouse. Nothing here runs on the main thread while idle except two CSS animations.
export default function Compass3D({ className = "" }: { className?: string }) {
  const fine = useMediaQuery(MEDIA.finePointer);
  const rx = useSpring(0, SPRING.soft);
  const ry = useSpring(0, SPRING.soft);

  return (
    <m.div
      className={`relative ${className}`}
      style={{ perspective: 700 }}
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING.soft, opacity: { duration: 0.4 } }}
      onPointerMove={
        fine
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const t = tiltFromPointer(e.clientX - r.left, e.clientY - r.top, r.width, r.height, 14);
              rx.set(t.rotateX);
              ry.set(t.rotateY);
            }
          : undefined
      }
      onPointerLeave={
        fine
          ? () => {
              rx.set(0);
              ry.set(0);
            }
          : undefined
      }
      aria-hidden
      data-testid="compass-3d"
    >
      <div className="absolute left-[12%] right-[12%] bottom-[2%] h-[16%] rounded-[50%] bg-black/60 blur-md" />
      <m.div className="absolute inset-0 preserve-3d" style={{ rotateX: rx, rotateY: ry }}>
        <div className="absolute inset-0 preserve-3d" style={{ transform: "rotateX(52deg)" }}>
          <div className="absolute inset-0 rounded-full shadow-[0_0_0_6px_#8a6a2c,0_0_0_9px_#d4a94a,0_18px_30px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-0 text-gold animate-spin-slow">
            <Rose />
          </div>
          <div className="compass-needle absolute inset-0">
            <div className="compass-needle-blade" />
            <div className="compass-needle-cap" />
          </div>
        </div>
      </m.div>
    </m.div>
  );
}
