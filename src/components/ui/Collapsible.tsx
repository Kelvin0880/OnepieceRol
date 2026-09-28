"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const PREFIX = "grandline:open:";
const listeners = new Set<() => void>();
// Kept in memory too, so a toggle still works when storage is blocked (private window, thumbnails).
const memory = new Map<string, boolean>();

function readStored(id: string): boolean | null {
  if (memory.has(id)) return memory.get(id)!;
  try {
    const v = localStorage.getItem(PREFIX + id);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Open/closed state remembered per viewer under `id`; `defaultOpen` until they choose. */
export function useOpenState(id: string, defaultOpen: boolean): [boolean, (next: boolean) => void] {
  const open = useSyncExternalStore(
    subscribe,
    () => readStored(id) ?? defaultOpen,
    () => defaultOpen
  );
  const set = (next: boolean) => {
    memory.set(id, next);
    try {
      localStorage.setItem(PREFIX + id, next ? "1" : "0");
    } catch {}
    listeners.forEach((l) => l());
  };
  return [open, set];
}

export function ToggleHeader({ open, onToggle, children, className = "", testId }: { open: boolean; onToggle: () => void; children: ReactNode; className?: string; testId?: string }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} data-testid={testId} className={`w-full flex items-center justify-between gap-2 text-left ${className}`}>
      <span className="flex-1 min-w-0">{children}</span>
      <ChevronDown className={`w-4 h-4 shrink-0 text-ink-dim transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

/** A titled section the reader can fold away; the choice is remembered on this device. */
export default function Collapsible({ id, title, count, defaultOpen = true, accent = "text-gold-bright", children }: { id: string; title: string; count?: number; defaultOpen?: boolean; accent?: string; children: ReactNode }) {
  const [open, setOpen] = useOpenState(id, defaultOpen);
  return (
    <section data-testid={`collapsible-${id}`}>
      <ToggleHeader open={open} onToggle={() => setOpen(!open)} testId={`collapsible-${id}-toggle`} className="mb-2">
        <span className={`font-display text-sm uppercase tracking-widest ${accent}`}>
          {title}
          {count !== undefined ? <span className="ml-2 text-xs text-ink-dim normal-case tracking-normal">({count})</span> : null}
        </span>
      </ToggleHeader>
      {open ? children : null}
    </section>
  );
}
