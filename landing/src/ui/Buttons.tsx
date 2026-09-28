import { motion, useMotionValue, useSpring } from "motion/react";
import type { MouseEvent, ReactNode, PointerEvent } from "react";

type Common = { children: ReactNode; className?: string; onClick?: (e: MouseEvent<HTMLElement>) => void; testId?: string };
type LinkProps = Common & { href: string; external?: boolean };

const base = "relative inline-flex items-center justify-center gap-2 rounded-full font-display font-bold tracking-[0.08em] uppercase select-none";

/** The gold call to action: a sheen crosses it on a loop and it leans towards the cursor. */
export function ShinyLink({ href, external, children, className = "", onClick, testId, size = "lg" }: LinkProps & { size?: "md" | "lg" }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18 });
  const sy = useSpring(y, { stiffness: 220, damping: 18 });
  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.25);
    y.set((e.clientY - r.top - r.height / 2) * 0.35);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  const pad = size === "lg" ? "px-8 py-4 text-sm sm:text-base" : "px-6 py-3 text-xs sm:text-sm";
  return (
    <motion.a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      onClick={onClick}
      data-testid={testId}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.96 }}
      className={`${base} ${pad} shiny text-abyss ${className}`}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.a>
  );
}

export function GhostLink({ href, external, children, className = "", onClick, testId }: LinkProps) {
  return (
    <motion.a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      onClick={onClick}
      data-testid={testId}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`${base} border border-gold/40 bg-abyss/40 px-6 py-3 text-xs text-ink backdrop-blur-sm hover:border-gold-bright hover:text-gold-bright sm:text-sm ${className}`}
    >
      {children}
    </motion.a>
  );
}

export function GhostButton({ children, className = "", onClick, testId, disabled }: Common & { disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      data-testid={testId}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`${base} border border-gold/40 bg-abyss/50 px-5 py-3 text-xs text-ink hover:border-gold-bright hover:text-gold-bright disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${className}`}
    >
      {children}
    </motion.button>
  );
}
