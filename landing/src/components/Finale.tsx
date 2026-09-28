import { BookOpen, Check, LoaderCircle, Map as MapIcon } from "lucide-react";
import { motion } from "motion/react";
import { GAME } from "../data/content";
import { GAME_URL } from "../lib/wake";
import { startWake, useWakeStatus } from "../hooks/useWake";
import { GhostLink, ShinyLink } from "../ui/Buttons";
import { Reveal } from "../ui/Reveal";
import { SplitText } from "../ui/SplitText";

const GLYPHS = ["M4 20h16M7 20V8l5-4 5 4v12M10 12h4", "M5 18c4-8 10-8 14 0M8 9h8M12 3v6", "M4 12h16M12 4v16M6 6l12 12", "M12 3l8 9-8 9-8-9zM12 8v8"];

function Poneglyphs() {
  const road = GAME.islands.filter((i) => i.poneglyph);
  return (
    <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="poneglyphs">
      {road.map((isl, i) => (
        <motion.div
          key={isl.key}
          initial={{ opacity: 0, y: 24, rotateX: 40 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.9, delay: 0.25 + i * 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="group relative overflow-hidden rounded-2xl border border-[#b0303a]/40 bg-[linear-gradient(160deg,#3a1418,#1d0b0e)] p-4 text-left"
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,120,110,0.35),transparent_65%)]"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0, 1, 0.55] }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, delay: 0.6 + i * 0.22 }}
          />
          <svg viewBox="0 0 24 24" className="relative h-7 w-7 fill-none stroke-[#ff9f8e]" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
            <path d={GLYPHS[i % GLYPHS.length]} />
          </svg>
          <p className="relative mt-3 font-display text-[0.7rem] tracking-[0.12em] text-[#ffcfc4] uppercase">{isl.poneglyph}</p>
          <p className="relative mt-1 text-sm text-ink-dim">{isl.name}</p>
        </motion.div>
      ))}
    </div>
  );
}

function WakePill() {
  const status = useWakeStatus();
  const label = {
    idle: "El barco está atracado",
    waking: "Despertando el barco… (el servidor gratuito tarda hasta un minuto)",
    ready: "Barco listo: puedes zarpar",
    unknown: "Si el barco tarda, dale un minuto: está despertando",
  }[status];
  return (
    <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-black/35 px-4 py-2 text-sm text-ink-dim" data-testid="wake-status" data-status={status}>
      {status === "ready" ? <Check className="h-4 w-4 text-jade" /> : status === "waking" ? <LoaderCircle className="h-4 w-4 animate-spin text-gold" /> : <span className="h-2 w-2 rounded-full bg-gold/60" />}
      {label}
    </p>
  );
}

export function Finale() {
  return (
    <section id="zarpa" className="relative flex min-h-svh items-center py-24 sm:py-32">
      <span aria-hidden data-sea="4" className="absolute inset-x-0 top-0 h-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,rgba(3,8,15,0.55),transparent_75%)]" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="eyebrow inline-block rounded-full border border-gold/30 bg-abyss/70 px-4 py-1.5">Capítulo V · Laugh Tale</p>
        </Reveal>
        <h2 className="mt-4 text-[clamp(2rem,5vw,4rem)] leading-[1.05] font-black text-ink [text-shadow:0_4px_30px_rgba(0,0,0,0.65)]" aria-label="Cuatro Poneglifos. Una isla. Un rey.">
          <SplitText text="Cuatro Poneglifos." className="block" />
          <SplitText text="Una isla. Un rey." className="block text-gold-bright" delay={0.45} />
        </h2>
        <Reveal delay={0.15}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink [text-shadow:0_2px_16px_rgba(0,0,0,0.7)] sm:text-xl">
            Aprende la escritura antigua entre las cenizas de Ohara, arranca los cuatro Poneglifos de Ruta a quienes los custodian y reúne una alianza para la batalla final. Lo que espera en Laugh Tale cambiará el mundo… y todavía nadie sabe qué es.
          </p>
        </Reveal>
        <Poneglyphs />
        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <ShinyLink href={GAME_URL} onClick={startWake} testId="finale-play">
              Crear mi personaje <span aria-hidden>⚓</span>
            </ShinyLink>
            <GhostLink href="guia.html" testId="finale-guide">
              <BookOpen className="h-4 w-4" /> Guía del jugador
            </GhostLink>
            <GhostLink href="mapa.html" testId="finale-map">
              <MapIcon className="h-4 w-4" /> Mapa de ruta
            </GhostLink>
          </div>
          <WakePill />
          <p className="mt-4 text-sm text-ink-mute">Gratis. Sin descargas. Desde el móvil o el ordenador.</p>
        </Reveal>
      </div>
    </section>
  );
}
