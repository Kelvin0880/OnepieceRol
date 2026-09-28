import Lenis from "lenis";
import { motionValue } from "motion/react";
import { useEffect } from "react";
import { param, setLenis } from "../lib/scroll";
import { buildAnchors, seaAt, type Anchor } from "../lib/voyage";
import { pointer, voyage } from "../three/store";

/** The same voyage position as the 3D scene, for DOM pieces that follow it (route indicator, CSS sky). */
export const voyageMV = motionValue(0);

function measure(): Anchor[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-sea]"));
  return buildAnchors(
    nodes.map((el) => {
      const r = el.getBoundingClientRect();
      return { y: r.top + window.scrollY + r.height / 2, sea: Number(el.dataset.sea) };
    }),
  );
}

/** Scroll drives the voyage: the viewport centre is placed between the centres of the sections, each tagged with data-sea. */
export function useVoyageTracker(): void {
  useEffect(() => {
    const forced = param("voyage");
    if (forced !== null && Number.isFinite(Number(forced))) {
      const v = Number(forced);
      voyage.target = voyage.current = v;
      voyageMV.set(v);
      return;
    }
    let anchors = measure();
    const ro = new ResizeObserver(() => {
      anchors = measure();
    });
    ro.observe(document.body);
    let raf = 0;
    const tick = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      let v = seaAt(anchors, window.scrollY + window.innerHeight / 2);
      if (window.scrollY >= max - 2 && anchors.length) v = Math.max(v, anchors[anchors.length - 1].sea);
      voyage.target = v;
      if (Math.abs(voyageMV.get() - v) > 1e-4) voyageMV.set(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
}

export function usePointerTracker(): void {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
}

/** Smooth wheel scrolling on desktop only; touch keeps the native feel and reduced motion keeps native scrolling. */
export function useSmoothScroll(): void {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine || param("voyage") !== null || param("nosmooth") !== null) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9 });
    setLenis(lenis);
    return () => {
      setLenis(null);
      lenis.destroy();
    };
  }, []);
}
