"use client";

import { useEffect, useRef, type ReactNode } from "react";

const WIDTHS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
} as const;

let openCount = 0;

// Bottom sheet on phones, centred card from `sm` up. Every panel of the game goes through here so Escape,
// scroll locking and the entrance animation behave the same everywhere.
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
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    openCount++;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      openCount--;
      if (openCount === 0) document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-[2px] animate-fade"
      onClick={onClose}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={`panel relative w-full ${WIDTHS[size]} max-h-[92dvh] overflow-y-auto overscroll-contain flex flex-col [&>*]:shrink-0 rounded-b-none sm:rounded-lg animate-sheet sm:animate-rise ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mt-2 mb-0 h-1 w-10 rounded-full bg-gold/30" aria-hidden />
        {children}
      </div>
    </div>
  );
}
