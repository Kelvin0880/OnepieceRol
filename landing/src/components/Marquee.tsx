import type { CSSProperties } from "react";
import { MARQUEE_BOTTOM, MARQUEE_TOP } from "../data/content";

function Row({ items, seconds, reverse = false, accent = false }: { items: string[]; seconds: number; reverse?: boolean; accent?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="mask-fade-x overflow-hidden">
      <div className="marquee-track flex w-max" data-reverse={reverse} style={{ "--marquee-duration": `${seconds}s` } as CSSProperties}>
        {doubled.map((text, i) => (
          <span key={i} aria-hidden={i >= items.length} className={`flex items-center gap-8 pr-8 font-display text-[0.78rem] tracking-[0.28em] uppercase sm:text-sm ${accent ? "text-gold-bright" : "text-ink-dim"}`}>
            {text}
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-gold/70" aria-hidden>
              <path d="M6 0l1.4 4.6L12 6 7.4 7.4 6 12 4.6 7.4 0 6l4.6-1.4z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Marquee() {
  return (
    <section aria-label="Lo que te espera en el juego" className="relative border-y border-gold/20 bg-abyss/75 py-5 backdrop-blur-[2px]">
      <div className="flex flex-col gap-3">
        <Row items={MARQUEE_TOP} seconds={46} accent />
        <Row items={MARQUEE_BOTTOM} seconds={52} reverse />
      </div>
    </section>
  );
}
