import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { Reveal } from "../ui/Reveal";
import { SplitText } from "../ui/SplitText";

/** One stop of the voyage: a giant chapter numeral drifting in the back, a glass panel on one side and the sea left visible on the other. */
export function Chapter({
  id,
  sea,
  numeral,
  seaName,
  title,
  lead,
  side = "left",
  children,
  after,
}: {
  id: string;
  sea: number;
  numeral: string;
  seaName: string;
  title: string;
  lead: string;
  side?: "left" | "right";
  children?: ReactNode;
  after?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["18%", "-18%"]);
  return (
    <section ref={ref} id={id} data-sea={sea} className="relative py-24 sm:py-32">
      <motion.span
        aria-hidden
        style={{ y }}
        className={`pointer-events-none absolute top-10 font-display text-[clamp(9rem,30vw,22rem)] leading-none font-black text-transparent [-webkit-text-stroke:1.5px_rgba(212,169,74,0.22)] select-none ${side === "left" ? "right-[4%]" : "left-[4%]"}`}
      >
        {numeral}
      </motion.span>
      <div className={`relative mx-auto flex min-h-[70svh] max-w-6xl items-center px-4 sm:px-6 ${side === "right" ? "lg:justify-end" : ""}`}>
        <div className="glass w-full rounded-3xl p-6 sm:p-9 lg:max-w-[36rem]">
          <Reveal>
            <p className="eyebrow">
              Capítulo {numeral} · {seaName}
            </p>
          </Reveal>
          <SplitText as="h2" text={title} className="mt-3 block text-[clamp(2.1rem,4.8vw,3.5rem)] font-bold text-ink" />
          <Reveal delay={0.15}>
            <p className="mt-5 text-lg text-ink-dim">{lead}</p>
          </Reveal>
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
      {after}
    </section>
  );
}
