import { COUNTS } from "../data/content";
import { NumberTicker } from "../ui/NumberTicker";
import { Reveal } from "../ui/Reveal";
import { SpotlightCard } from "../ui/Spotlight";
import { SplitText } from "../ui/SplitText";

const f = COUNTS.fruitsByType as Record<string, number>;

const STATS = [
  { value: COUNTS.islands, label: "Islas jugables", note: "de East Blue a Laugh Tale" },
  { value: COUNTS.fruits, label: "Frutas del Diablo", note: `${f.PARAMECIA} Paramecia · ${f.ZOAN} Zoan · ${f.LOGIA} Logia` },
  { value: COUNTS.canon, label: "Personajes canon", note: "que viajan y actúan por su cuenta" },
  { value: COUNTS.residents, label: "Habitantes con nombre", note: "con oficio, memoria y rencores" },
  { value: COUNTS.factions, label: "Bandos", note: "Pirata, Marina, Revolución, Cazarrecompensas, CP-0" },
  { value: COUNTS.roadPoneglyphs + COUNTS.historyPoneglyphs, label: "Poneglifos", note: `${COUNTS.roadPoneglyphs} de Ruta y ${COUNTS.historyPoneglyphs} de Historia` },
];

export function Numbers() {
  return (
    <section id="mundo" data-sea="0.28" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow">El mundo, en cifras</p>
          </Reveal>
          <SplitText as="h2" text="Un mundo entero cabe en tu barco" className="mt-3 block text-[clamp(2rem,4.6vw,3.3rem)] font-bold text-ink [text-shadow:0_2px_20px_rgba(0,0,0,0.6)]" />
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <SpotlightCard className="h-full p-5 sm:p-7" data-testid="stat-card">
                <NumberTicker value={s.value} className="block font-display text-[clamp(2.3rem,6vw,4rem)] leading-none font-black text-gold-bright" />
                <p className="mt-3 font-display text-[0.72rem] font-bold tracking-[0.18em] text-ink uppercase sm:text-sm">{s.label}</p>
                <p className="mt-1.5 text-sm leading-snug text-ink-dim sm:text-base">{s.note}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
