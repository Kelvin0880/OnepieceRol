import { motion, useMotionValueEvent } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { voyageMV } from "../hooks/useVoyage";
import { OceanSound } from "../lib/ocean-sound";
import { smoothstep } from "../lib/voyage";
import { thunder } from "../three/store";

/** Off by default; the sea only sounds after a click (browsers require a gesture anyway). */
export function SoundToggle() {
  const [on, setOn] = useState(false);
  const sound = useRef<OceanSound | null>(null);

  useMotionValueEvent(voyageMV, "change", (v) => sound.current?.setStorm(smoothstep(2.4, 3, v) * (1 - smoothstep(3.4, 3.9, v))));

  useEffect(() => {
    const onStrike = () => {
      if (on) sound.current?.thunder(0.5 + Math.random() * 0.8);
    };
    thunder.addEventListener("strike", onStrike);
    return () => thunder.removeEventListener("strike", onStrike);
  }, [on]);

  useEffect(() => () => sound.current?.dispose(), []);

  const toggle = async () => {
    if (!sound.current) sound.current = new OceanSound();
    if (on) {
      sound.current.stop();
      setOn(false);
    } else {
      await sound.current.start();
      sound.current.setStorm(0);
      setOn(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Silenciar el mar" : "Escuchar el mar"}
      className="glass fixed bottom-4 left-4 z-40 flex items-center gap-2.5 rounded-full px-4 py-2.5 font-display text-[0.62rem] tracking-[0.2em] text-ink-dim uppercase hover:text-gold-bright"
      data-testid="sound-toggle"
    >
      <span className="flex h-3.5 items-end gap-[3px]" aria-hidden>
        {[0.55, 1, 0.7, 0.85].map((h, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-gold"
            animate={on ? { height: [`${h * 40}%`, "100%", `${h * 60}%`, `${h * 90}%`] } : { height: "25%" }}
            transition={on ? { duration: 1.1 + i * 0.2, repeat: Infinity, repeatType: "mirror" } : { duration: 0.3 }}
          />
        ))}
      </span>
      <span className="hidden sm:inline">{on ? "Silenciar el mar" : "Escuchar el mar"}</span>
    </button>
  );
}
