import { useEffect, useSyncExternalStore } from "react";
import { wakeServer, type WakeStatus } from "../lib/wake";

let status: WakeStatus = "idle";
const listeners = new Set<() => void>();

function set(next: WakeStatus) {
  status = next;
  listeners.forEach((l) => l());
}

/** Knocks on the game server once per visit; later calls are no-ops. */
export function startWake(): void {
  if (status !== "idle") return;
  set("waking");
  void wakeServer().then(set);
}

export function useWakeStatus(): WakeStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}

/** Wakes the server once the visitor shows interest: a bit of scrolling or a little time on the page. */
export function useWakeOnInterest(): void {
  useEffect(() => {
    const timer = window.setTimeout(startWake, 12_000);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > 0.2) startWake();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}
