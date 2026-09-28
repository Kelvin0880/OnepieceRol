import { Globe, Radio, RotateCcw, Scale, Skull, Sparkles, Swords, Trophy, Users, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { SYSTEMS } from "../data/content";
import { Reveal } from "../ui/Reveal";
import { SpotlightCard } from "../ui/Spotlight";
import { SplitText } from "../ui/SplitText";

const ICONS: Record<(typeof SYSTEMS)[number]["key"], LucideIcon> = {
  referee: Scale,
  death: Skull,
  world: Globe,
  crew: Users,
  duel: Swords,
  power: Sparkles,
  denden: Radio,
  arena: Trophy,
  ooc: RotateCcw,
};

/** A small live illustration for the headline card: an exchange being judged, beat by beat. */
function Verdict() {
  const lines = ["Tu amago: bien leído", "Barrido: le cede la rodilla", "Su contraataque: anunciado"];
  return (
    <div className="mt-6 flex flex-col gap-2" aria-hidden>
      {lines.map((l, i) => (
        <motion.div
          key={l}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.35, duration: 0.6 }}
          className="flex items-center gap-3 rounded-xl border border-gold/15 bg-black/25 px-3 py-2 text-sm text-ink-dim"
        >
          <motion.span
            className="h-2 w-2 shrink-0 rounded-full bg-gold"
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }}
          />
          {l}
        </motion.div>
      ))}
    </div>
  );
}

export function Systems() {
  return (
    <section id="sistemas" data-sea="3.62" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow">Todo lo que late</p>
          </Reveal>
          <SplitText as="h2" text="Un mundo que sigue sin ti" className="mt-3 block text-[clamp(2.1rem,4.8vw,3.4rem)] font-bold text-ink [text-shadow:0_2px_20px_rgba(0,0,0,0.6)]" />
        </div>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {SYSTEMS.map((s, i) => {
            const Icon = ICONS[s.key];
            const hero = i === 0;
            return (
              <Reveal key={s.key} delay={(i % 3) * 0.08} className={hero ? "sm:col-span-2 lg:row-span-2" : ""}>
                <SpotlightCard beam={hero} className={`h-full p-6 ${hero ? "sm:p-8" : ""}`} data-testid="system-card">
                  <span className={`grid place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-bright ${hero ? "h-14 w-14" : "h-11 w-11"}`}>
                    <Icon className={hero ? "h-7 w-7" : "h-5 w-5"} />
                  </span>
                  <h3 className={`mt-5 font-bold text-ink ${hero ? "text-3xl" : "text-xl"}`}>{s.title}</h3>
                  <p className={`mt-2 leading-snug text-ink-dim ${hero ? "text-lg" : ""}`}>{s.text}</p>
                  {hero && <Verdict />}
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
