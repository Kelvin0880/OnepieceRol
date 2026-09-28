import { Feather, RefreshCw, Scale, Skull, Swords } from "lucide-react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DEMO, type DemoRole } from "../data/content";
import { Reveal } from "../ui/Reveal";
import { SplitText } from "../ui/SplitText";
import { StatBar } from "../ui/StatBar";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Text that types itself; the full sentence is the accessible label from the first frame. */
function Typed({ text, speed }: { text: string; speed: number }) {
  const count = useMotionValue(0);
  const shown = useTransform(count, (v) => text.slice(0, Math.round(v)));
  useEffect(() => {
    const controls = animate(count, text.length, { duration: text.length / speed, ease: "linear" });
    return () => controls.stop();
  }, [count, text, speed]);
  return (
    <span aria-label={text}>
      <motion.span aria-hidden>{shown}</motion.span>
    </span>
  );
}

const ROLE_LABEL: Record<DemoRole, string> = { player: "Tú", narrator: "Narrador", referee: "Árbitro" };

function Bubble({ role, text }: { role: DemoRole; text: string }) {
  const mine = role === "player";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-snug ${
          mine ? "rounded-br-md bg-gradient-to-br from-[#e9c56f] to-[#c8963a] text-[#1d1409]" : "rounded-bl-md border border-gold/15 bg-[#0e1a28] text-ink"
        }`}
      >
        <p className={`mb-1 flex items-center gap-1.5 font-display text-[0.6rem] tracking-[0.2em] uppercase ${mine ? "text-[#4a3413]" : role === "referee" ? "text-[#ff9f7e]" : "text-gold"}`}>
          {role === "referee" ? <Scale className="h-3 w-3" /> : role === "narrator" ? <Feather className="h-3 w-3" /> : <Swords className="h-3 w-3" />}
          {ROLE_LABEL[role]}
        </p>
        <Typed text={text} speed={mine ? 55 : 95} />
      </div>
    </motion.div>
  );
}

function Thinking({ role }: { role: DemoRole }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-1 text-[0.8rem] text-ink-dim italic">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-gold/80" animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </span>
      {role === "referee" ? "El árbitro juzga el intercambio…" : "El narrador escribe…"}
    </motion.div>
  );
}

function Phone() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const [shown, setShown] = useState(0);
  const [thinking, setThinking] = useState<DemoRole | null>(null);
  const [bars, setBars] = useState({ life: 100, stamina: 100 });
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  const feed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!seen) return;
    let cancelled = false;
    setShown(0);
    setBars({ life: 100, stamina: 100 });
    setDone(false);
    (async () => {
      await wait(500);
      for (let i = 0; i < DEMO.steps.length; i++) {
        const s = DEMO.steps[i];
        if (cancelled) return;
        if (s.role !== "player") {
          setThinking(s.role);
          await wait(1300);
          if (cancelled) return;
          setThinking(null);
        }
        setShown(i + 1);
        await wait(s.role === "player" ? 700 + s.text.length * 18 : 500 + s.text.length * 10.5);
        if (cancelled) return;
        if (s.bars) setBars(s.bars);
        await wait(s.bars ? 1300 : 400);
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [seen, run]);

  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    const id = window.setInterval(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[25rem]" data-testid="demo-phone">
      <div aria-hidden className="absolute -inset-6 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(212,169,74,0.22),transparent)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[2.2rem] border border-gold/30 bg-[#08111c]/95 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between border-b border-gold/15 bg-[#0b1623] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#f0c869] to-[#9a7328] text-[#1d1409]">
              <Skull className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-[0.72rem] tracking-[0.18em] text-gold uppercase">Escena · {DEMO.place}</p>
              <p className="text-[0.8rem] text-ink-dim">{DEMO.who}</p>
            </div>
          </div>
          <span className="rounded-full border border-blood/40 bg-blood/15 px-2 py-0.5 font-display text-[0.6rem] tracking-[0.14em] text-[#ff9f7e] uppercase">En combate</span>
        </div>
        <div className="flex gap-4 border-b border-gold/10 px-4 py-3">
          <StatBar label="Vida" value={bars.life} tone="life" />
          <StatBar label="Aguante" value={bars.stamina} tone="stamina" />
        </div>
        <div ref={feed} data-lenis-prevent className="flex h-[27rem] flex-col gap-3 overflow-y-auto px-3.5 py-4 [scrollbar-width:none]" aria-live="polite">
          {DEMO.steps.slice(0, shown).map((s, i) => (
            <Bubble key={`${run}-${i}`} role={s.role} text={s.text} />
          ))}
          <AnimatePresence>{thinking && <Thinking key={thinking + shown} role={thinking} />}</AnimatePresence>
        </div>
        <div className="flex items-center gap-2 border-t border-gold/15 bg-[#0b1623] px-3 py-3">
          <div className="flex-1 truncate rounded-xl border border-gold/15 bg-black/30 px-3 py-2 text-[0.9rem] text-ink-mute italic">Describe lo que haces…</div>
          {done ? (
            <button
              type="button"
              onClick={() => setRun((r) => r + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-gold px-3 py-2 font-display text-[0.65rem] tracking-[0.16em] text-abyss uppercase"
              data-testid="demo-replay"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Repetir
            </button>
          ) : (
            <span className="rounded-xl bg-gold/30 px-3 py-2 font-display text-[0.65rem] tracking-[0.16em] text-abyss/80 uppercase">Actuar</span>
          )}
        </div>
      </div>
    </div>
  );
}

const PILLARS = [
  { icon: Scale, title: "Un árbitro, no un dado", text: "Lo que describes cuenta: la IA mira tu nivel, tu Haki, tu fruta, tu arma y tu cansancio antes de decidir." },
  { icon: Swords, title: "Tú decides cómo recibirlo", text: "El rival te anuncia su ataque. Esquivar, bloquear o contraatacar: lo escribes tú." },
  { icon: Skull, title: "Aquí se muere", text: "La vida del rival no se ve: se lee en la escena. La tuya sí. Y si llega a cero, puede ser para siempre." },
];

export function DemoScene() {
  return (
    <section id="juego" data-sea="0.12" className="relative py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <div className="glass rounded-3xl p-6 sm:p-9">
          <Reveal>
            <p className="eyebrow">Cómo se juega</p>
          </Reveal>
          <SplitText as="h2" text="No tiras dados. Escribes." className="mt-3 block text-[clamp(2.2rem,5vw,3.6rem)] font-bold text-ink" />
          <Reveal delay={0.15}>
            <p className="mt-5 text-lg text-ink-dim">
              Describe tu jugada como en un rol de foro. La IA narra la escena, da voz a cada habitante de la isla y arbitra cada intercambio de golpes. Sin tiradas: <span className="text-ink">juzga lo que haces y cómo lo haces.</span>
            </p>
          </Reveal>
          <ul className="mt-8 flex flex-col gap-5">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={0.2 + i * 0.1}>
                <li className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold-bright">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold tracking-[0.08em] text-ink uppercase">{p.title}</p>
                    <p className="mt-1 text-ink-dim">{p.text}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
        <Phone />
      </div>
    </section>
  );
}
