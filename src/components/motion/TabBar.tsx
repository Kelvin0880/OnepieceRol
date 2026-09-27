"use client";

import { useLayoutEffect, useRef, type ComponentType, type ReactNode } from "react";
import { m, useSpring } from "motion/react";
import { SPRING } from "./presets";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  testId?: string;
  badge?: number;
}

const SIZE = {
  md: "px-3 py-1.5 text-sm rounded-md",
  sm: "px-3 py-1 text-xs rounded-full",
} as const;

// One tab strip for every panel: a single marker slides between tabs. It is placed from the active button's
// offsetLeft/offsetTop, which ignore ancestor transforms, so it stays glued to its tab even while the panel
// around it swings open in 3D (a shared-layout `layoutId` animation would drift there). Moving it only touches
// motion values: no React re-render. `solid` = gold pill like btn-gold, `outline` = gold ring like a chip.
export default function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  variant = "solid",
  size = "md",
  className = "",
  label,
  stretch = false,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: "solid" | "outline";
  size?: keyof typeof SIZE;
  className?: string;
  label?: string;
  // tabs share the full width equally (a two-way switch)
  stretch?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef<T | null>(null);
  const x = useSpring(0, SPRING.snappy);
  const y = useSpring(0, SPRING.snappy);
  const w = useSpring(0, SPRING.snappy);
  const h = useSpring(0, SPRING.snappy);
  const shown = useSpring(0, { stiffness: 400, damping: 40 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const place = (animate: boolean) => {
      const el = wrap.querySelector<HTMLElement>('[data-tab-active="true"]');
      if (!el || el.offsetWidth === 0) {
        shown.jump(0);
        return;
      }
      const to = [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight];
      [x, y, w, h].forEach((mv, i) => (animate ? mv.set(to[i]) : mv.jump(to[i])));
      shown.jump(1);
    };
    place(lastValue.current !== null && lastValue.current !== value);
    lastValue.current = value;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [value, tabs.length, x, y, w, h, shown]);

  return (
    <div ref={wrapRef} className={`relative flex gap-2 ${stretch ? "" : "flex-wrap"} ${className}`} aria-label={label}>
      <m.span
        aria-hidden
        className={`absolute left-0 top-0 pointer-events-none ${size === "sm" ? "rounded-full" : "rounded-md"} ${variant === "solid" ? "tab-pill-solid" : "tab-pill-outline"}`}
        style={{ x, y, width: w, height: h, opacity: shown }}
      />
      {tabs.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        const idle = variant === "solid" ? "border-line text-ink hover:border-gold hover:bg-gold/10" : "border-white/15 text-ink-dim hover:text-ink";
        const on = variant === "solid" ? "border-transparent text-sea-deep font-bold" : "border-transparent text-gold-bright";
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            data-tab-active={active}
            onClick={() => onChange(t.id)}
            data-testid={t.testId}
            className={`relative whitespace-nowrap border ${stretch ? "flex-1 min-w-0" : "shrink-0"} transition-colors duration-150 active:translate-y-px ${SIZE[size]} ${active ? on : idle}`}
          >
            <span className={`inline-flex items-center gap-1.5 ${stretch ? "justify-center w-full" : ""}`}>
              {Icon && <Icon className="w-4 h-4" />}
              {t.label}
              {!!t.badge && t.badge > 0 && <span className="badge-count">{t.badge}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Content under a TabBar fades in when the tab changes. Enter only: the old tab leaves at once, so nothing
// lingers in the DOM.
export function TabPanel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <m.div key={id} className={className} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </m.div>
  );
}
