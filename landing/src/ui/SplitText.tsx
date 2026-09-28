import { motion } from "motion/react";

/** Letters surface one after another out of a blur; words stay together so lines still wrap cleanly. */
export function SplitText({
  text,
  as: Tag = "span",
  className,
  delay = 0,
  stagger = 0.03,
  inView = true,
  charClassName = "",
}: {
  text: string;
  as?: "span" | "h2" | "h3" | "p" | "div";
  className?: string;
  delay?: number;
  stagger?: number;
  inView?: boolean;
  charClassName?: string;
}) {
  const words = text.split(" ");
  let index = 0;
  const trigger = inView ? { whileInView: "show", viewport: { once: true, amount: 0.6 } } : { animate: "show" };
  return (
    <Tag className={className} aria-label={text}>
      <motion.span initial="hidden" {...trigger} className="inline" aria-hidden>
        {words.map((word, w) => (
          <span key={w} className="inline-block whitespace-nowrap">
            {Array.from(word).map((ch) => {
              const i = index++;
              return (
                <motion.span
                  key={i}
                  className={`inline-block ${charClassName}`}
                  variants={{
                    hidden: { y: "0.45em", opacity: 0, filter: "blur(10px)" },
                    show: { y: "0em", opacity: 1, filter: "blur(0px)", transition: { duration: 0.9, delay: delay + i * stagger, ease: [0.22, 1, 0.36, 1] } },
                  }}
                >
                  {ch}
                </motion.span>
              );
            })}
            {w < words.length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
