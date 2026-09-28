import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { scrollToId } from "../lib/scroll";
import { GAME_URL } from "../lib/wake";
import { startWake } from "../hooks/useWake";
import { ShinyLink } from "../ui/Buttons";

const LINKS = [
  { id: "juego", label: "Cómo se juega" },
  { id: "viaje", label: "El viaje" },
  { id: "cartel", label: "Tu cartel" },
  { id: "frutas", label: "Frutas" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > prev + 2 && y > 480);
    if (y < prev - 2) setHidden(false);
    setSolid(y > 40);
  });
  return (
    <motion.header
      initial={{ y: -90 }}
      animate={{ y: hidden ? -96 : 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4"
    >
      <div className={`mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full py-2 pr-2 pl-3 transition-[background-color,border-color,box-shadow] duration-500 sm:pl-4 ${solid ? "glass" : "border border-white/5 bg-abyss/25 backdrop-blur-[3px]"}`}>
        <a href="#top" onClick={(e) => (e.preventDefault(), scrollToId("top"))} className="flex items-center gap-2.5" aria-label="Grand Line RPG, inicio">
          <img src="./favicon.svg" alt="" className="h-8 w-8 drop-shadow-[0_2px_8px_rgba(212,169,74,0.35)]" width={32} height={32} />
          <span className="font-display text-[0.8rem] font-bold tracking-[0.22em] text-ink sm:text-sm">GRAND LINE</span>
        </a>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Secciones">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={(e) => (e.preventDefault(), scrollToId(l.id))}
              className="rounded-full px-3 py-2 font-display text-[0.72rem] tracking-[0.16em] text-ink-dim uppercase transition-colors hover:text-gold-bright"
            >
              {l.label}
            </a>
          ))}
          <a href="guia.html" className="rounded-full px-3 py-2 font-display text-[0.72rem] tracking-[0.16em] text-ink-dim uppercase transition-colors hover:text-gold-bright">
            Guía
          </a>
          <a href="mapa.html" className="rounded-full px-3 py-2 font-display text-[0.72rem] tracking-[0.16em] text-ink-dim uppercase transition-colors hover:text-gold-bright">
            Mapa
          </a>
        </nav>
        <ShinyLink href={GAME_URL} size="md" onClick={startWake} testId="nav-play">
          Jugar
        </ShinyLink>
      </div>
    </motion.header>
  );
}
