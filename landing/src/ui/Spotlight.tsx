import type { HTMLAttributes, PointerEvent } from "react";

/** A card whose border and surface light up where the cursor is (CSS variables only, no re-render). */
export function SpotlightCard({ className = "", children, beam = false, ...rest }: HTMLAttributes<HTMLDivElement> & { beam?: boolean }) {
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div onPointerMove={onMove} className={`spotlight glass glass-strong relative overflow-hidden rounded-2xl ${className}`} {...rest}>
      {beam && <span className="border-beam" aria-hidden />}
      {children}
    </div>
  );
}
