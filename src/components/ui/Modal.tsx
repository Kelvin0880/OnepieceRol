"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { m, useDragControls, useIsPresent, type PanInfo } from "motion/react";
import { shouldDismissSheet } from "@/lib/ui/motion";
import { EASE_IN, EASE_OUT, MEDIA, SPRING } from "@/components/motion/presets";
import { useMediaQuery } from "@/components/motion/useMediaQuery";

const WIDTHS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
} as const;

// Longest exit animation plus margin: if the animation never reports back (features still loading, tab hidden),
// the modal closes anyway.
const EXIT_FALLBACK_MS = 320;

let openCount = 0;

// Bottom sheet on phones (drag the handle down to close), a card that swings open in 3D from `sm` up. Every
// panel of the game goes through here so Escape, scroll locking and the animations behave the same everywhere.
export default function Modal({
  onClose,
  children,
  size = "lg",
  className = "",
  testId,
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof WIDTHS;
  className?: string;
  testId?: string;
  label?: string;
}) {
  const desktop = useMediaQuery(MEDIA.desktop);
  // Under an AnimatePresence the parent can close us too (a "Cerrar" button inside the panel): same exit.
  const present = useIsPresent();
  const presentRef = useRef(present);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const closeRef = useRef(onClose);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    if (timer.current) clearTimeout(timer.current);
    closeRef.current();
  }, []);

  const requestClose = useCallback(() => {
    if (finished.current || timer.current || !presentRef.current) return;
    setLeaving(true);
    timer.current = setTimeout(finish, EXIT_FALLBACK_MS);
  }, [finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    openCount++;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
      openCount--;
      if (openCount === 0) document.body.style.overflow = "";
    };
  }, [requestClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const h = sheetRef.current?.offsetHeight ?? 600;
    if (shouldDismissSheet(info.offset.y, info.velocity.y, h)) requestClose();
  };

  const sheetOut = { y: "100%", transition: { duration: 0.22, ease: EASE_IN } };
  const cardOut = { opacity: 0, y: 18, rotateX: 8, scale: 0.96, transition: { duration: 0.18, ease: EASE_IN } };
  const sheet = {
    initial: { y: "100%" },
    animate: leaving ? sheetOut : { y: 0, transition: SPRING.sheet },
    exit: sheetOut,
  };
  const card = {
    initial: { opacity: 0, y: 28, rotateX: -14, scale: 0.94 },
    animate: leaving ? cardOut : { opacity: 1, y: 0, rotateX: 0, scale: 1, transition: { ...SPRING.soft, opacity: { duration: 0.2, ease: EASE_OUT } } },
    exit: cardOut,
  };
  const motionProps = desktop ? card : sheet;
  // A modal its parent already removed lets clicks through at once (to whatever opened next); one closing itself
  // (Escape, backdrop, swipe) keeps taking them, so a click on its own "Cerrar" mid-exit still lands.
  const released = !present;

  return (
    <m.div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-[2px] ${released ? "pointer-events-none" : ""}`}
      onClick={requestClose}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: leaving ? 0.2 : 0.22 }}
    >
      <m.div
        ref={sheetRef}
        key={desktop ? "card" : "sheet"}
        className={`panel relative w-full ${WIDTHS[size]} max-h-[92dvh] overflow-y-auto overscroll-contain flex flex-col [&>*]:shrink-0 rounded-b-none sm:rounded-lg ${className}`}
        style={desktop ? { transformPerspective: 1400, originY: 0 } : undefined}
        onClick={(e) => e.stopPropagation()}
        initial={motionProps.initial}
        animate={motionProps.animate}
        exit={motionProps.exit}
        onAnimationComplete={() => {
          if (leaving) finish();
        }}
        drag={desktop ? false : "y"}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.9 }}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        <div
          className="sm:hidden flex justify-center pt-2 pb-1 -mb-1 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          aria-hidden
          data-testid="sheet-handle"
        >
          <div className="h-1 w-10 rounded-full bg-gold/40" />
        </div>
        {children}
      </m.div>
    </m.div>
  );
}
