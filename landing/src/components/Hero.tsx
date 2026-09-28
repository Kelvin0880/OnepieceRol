import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { COUNTS } from "../data/content";
import { scrollToId } from "../lib/scroll";
import { GAME_URL } from "../lib/wake";
import { startWake } from "../hooks/useWake";
import { GhostLink, ShinyLink } from "../ui/Buttons";
import { SplitText } from "../ui/SplitText";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({ delay, og = false }: { delay: number; og?: boolean }) {
  return (
    <section id="top" data-sea="0" className="relative flex min-h-svh items-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,15,0.72)_0%,rgba(3,8,15,0.35)_45%,transparent_70%)] md:bg-[radial-gradient(ellipse_62%_70%_at_22%_48%,rgba(3,8,15,0.62),transparent_72%)]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 pt-28 pb-24 max-md:self-start sm:px-6 md:pt-24">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay, ease }}
          className="inline-flex items-center gap-2.5 rounded-full border border-gold/30 bg-abyss/50 px-4 py-1.5 font-display text-[0.66rem] tracking-[0.26em] text-ink-dim uppercase backdrop-blur-sm sm:text-[0.72rem]"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jade opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-jade" />
          </span>
          Mundo vivo · Rol por texto<span className="hidden sm:inline"> · Multijugador</span>
        </motion.p>

        <h1 className="title-glow mt-6 font-display font-black" aria-label="Grand Line RPG">
          <SplitText text="GRAND LINE" inView={false} delay={delay + 0.1} stagger={0.055} charClassName="gold-metal" className="block text-[clamp(3.1rem,10.4vw,8.4rem)] leading-[0.95] tracking-[0.01em]" />
          <motion.span
            initial={{ opacity: 0, letterSpacing: "1.2em" }}
            animate={{ opacity: 1, letterSpacing: "0.62em" }}
            transition={{ duration: 1.6, delay: delay + 0.7, ease }}
            className="mt-2 block text-[clamp(0.95rem,2.6vw,1.45rem)] font-bold text-ink-dim"
          >
            RPG
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, delay: delay + 0.9, ease }}
          className="mt-7 max-w-xl text-[1.2rem] leading-relaxed text-ink [text-shadow:0_2px_18px_rgba(0,0,0,0.6)] sm:text-[1.35rem]"
        >
          Escribe lo que haces. <span className="text-gold-bright">Una IA arbitra cada golpe.</span> La muerte es de verdad. Y el mundo no te espera.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: delay + 1.15, ease }} className="mt-9 flex flex-wrap items-center gap-3 sm:gap-4">
          <ShinyLink href={GAME_URL} onClick={startWake} testId="hero-play">
            Zarpar ahora <span aria-hidden>⚓</span>
          </ShinyLink>
          <GhostLink
            href="#juego"
            onClick={(e) => {
              e.preventDefault();
              scrollToId("juego");
            }}
            testId="hero-how"
          >
            Cómo se juega
          </GhostLink>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: delay + 1.45 }}
          className="mt-10 hidden flex-wrap gap-x-6 gap-y-2 font-display text-[0.7rem] tracking-[0.2em] text-ink-dim uppercase sm:flex sm:text-xs"
        >
          <li>
            <b className="text-gold-bright">{COUNTS.islands}</b> islas
          </li>
          <li>
            <b className="text-gold-bright">{COUNTS.fruits}</b> frutas del diablo
          </li>
          <li>
            <b className="text-gold-bright">{COUNTS.canon}</b> personajes canon
          </li>
        </motion.ul>
      </div>

      {!og && <motion.button
        type="button"
        onClick={() => scrollToId("juego")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 2, duration: 1 }}
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 font-display text-[0.62rem] tracking-[0.3em] text-ink-dim uppercase"
        aria-label="Bajar a cómo se juega"
      >
        Desliza para zarpar
        <motion.span animate={{ y: [0, 7, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown className="h-5 w-5 text-gold" />
        </motion.span>
      </motion.button>}
    </section>
  );
}
