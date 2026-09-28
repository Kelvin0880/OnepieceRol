import { Dice5, Droplets, Lock, Sparkles as SparklesIcon } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { COUNTS, FRUIT_COLORS, FRUIT_TYPE_LABEL, GAME, RARITY_LABEL } from "../data/content";
import { GhostButton } from "../ui/Buttons";
import { Reveal } from "../ui/Reveal";
import { SplitText } from "../ui/SplitText";

const FruitCanvas = lazy(() => import("../three/FruitCanvas"));

const RULES = [
  { icon: Droplets, text: "Comerla es para siempre: el mar te rechaza y ya no podrás nadar." },
  { icon: Lock, text: "Algunas son únicas en el mundo. Si otro la tiene, no hay más." },
  { icon: SparklesIcon, text: "Cada fruta crece por fases hasta el Despertar." },
];

const byType = COUNTS.fruitsByType as Record<string, number>;

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function FruitSection() {
  const fruits = GAME.fruits;
  const start = Math.max(0, fruits.findIndex((f) => f.name === "Mera Mera no Mi"));
  const [index, setIndex] = useState(start);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const near = useInView(stage, { margin: "300px 0px" });
  const visible = useInView(stage, { amount: 0.15 });
  const [mounted, setMounted] = useState(false);
  const can3d = useMemo(() => typeof window !== "undefined" && webglOk() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const fine = useMemo(() => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches, []);
  useEffect(() => {
    if (near) setMounted(true);
  }, [near]);

  const fruit = fruits[index];
  const colors = FRUIT_COLORS[fruit.type] ?? FRUIT_COLORS.PARAMECIA;

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    let next = index;
    for (let i = 0; i < 24; i++) {
      next = Math.floor(Math.random() * fruits.length);
      setIndex(next);
      await new Promise((r) => setTimeout(r, 45 + i * i * 0.55));
    }
    setSpinning(false);
    setLanded((n) => n + 1);
  };

  return (
    <section id="frutas" data-sea="3.3" className="relative py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="glass rounded-3xl p-6 sm:p-9">
          <Reveal>
            <p className="eyebrow">Frutas del Diablo</p>
          </Reveal>
          <SplitText as="h2" text="Poder a cambio del mar" className="mt-3 block text-[clamp(2.1rem,4.8vw,3.4rem)] font-bold text-ink" />
          <Reveal delay={0.12}>
            <p className="mt-5 text-lg text-ink-dim">
              {COUNTS.fruits} frutas en el mundo, de las más humildes a las que solo existen una vez. Se encuentran explorando, se ganan en eventos o se compran en el mercado negro… si te fías del vendedor.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-6 flex flex-wrap gap-2">
              {(["PARAMECIA", "ZOAN", "LOGIA"] as const).map((t) => (
                <span key={t} className="rounded-full border px-3.5 py-1.5 font-display text-[0.7rem] tracking-[0.16em] uppercase" style={{ borderColor: `${FRUIT_COLORS[t][0]}88`, color: FRUIT_COLORS[t][0], background: `${FRUIT_COLORS[t][0]}14` }}>
                  {FRUIT_TYPE_LABEL[t]} · {byType[t]}
                </span>
              ))}
            </div>
          </Reveal>
          <ul className="mt-7 flex flex-col gap-3.5">
            {RULES.map((r, i) => (
              <Reveal key={r.text} delay={0.22 + i * 0.08}>
                <li className="flex items-start gap-3 text-ink-dim">
                  <r.icon className="mt-1 h-4.5 w-4.5 shrink-0 text-gold" />
                  {r.text}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <div ref={stage} className="relative">
          <div className="relative mx-auto aspect-square w-full max-w-[26rem]" data-testid="fruit-stage">
            <div aria-hidden className="absolute inset-[12%] rounded-full blur-3xl transition-colors duration-700" style={{ background: `${colors[0]}40` }} />
            {can3d && mounted ? (
              <Suspense fallback={null}>
                <FruitCanvas colors={colors} active={visible} interactive={fine} />
              </Suspense>
            ) : (
              <div className="absolute inset-[18%] rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${colors[0]}, ${colors[1]} 70%)` }} />
            )}
          </div>
          <motion.div
            key={landed}
            initial={landed ? { scale: 0.96 } : false}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
            className="glass relative -mt-6 rounded-3xl p-5 sm:p-6"
            data-testid="fruit-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.h3
                    key={fruit.name}
                    initial={{ y: spinning ? 14 : 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ duration: spinning ? 0.08 : 0.35 }}
                    className="truncate text-2xl font-bold text-ink"
                  >
                    {fruit.name}
                  </motion.h3>
                </AnimatePresence>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full px-2.5 py-0.5 font-display text-[0.62rem] tracking-[0.14em] uppercase" style={{ background: `${colors[0]}26`, color: colors[0] }}>
                    {FRUIT_TYPE_LABEL[fruit.sub] ?? FRUIT_TYPE_LABEL[fruit.type]}
                  </span>
                  <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-display text-[0.62rem] tracking-[0.14em] text-gold-bright uppercase">{RARITY_LABEL[fruit.rarity] ?? fruit.rarity}</span>
                </div>
              </div>
              <GhostButton onClick={spin} disabled={spinning} testId="fruit-spin" className="shrink-0">
                <Dice5 className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} /> {spinning ? "Girando" : "Probar suerte"}
              </GhostButton>
            </div>
            <p className={`mt-4 line-clamp-4 min-h-[5.5rem] leading-snug text-ink-dim transition-opacity ${spinning ? "opacity-40" : "opacity-100"}`}>{fruit.description}</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
