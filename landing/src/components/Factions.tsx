import { Anchor, Crosshair, Flame, MapPin, Skull, VenetianMask, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { FACTION_COPY, GAME } from "../data/content";
import { Reveal } from "../ui/Reveal";
import { TiltCard } from "../ui/TiltCard";

const ICONS: Record<string, LucideIcon> = { PIRATE: Skull, MARINE: Anchor, REVOLUTIONARY: Flame, BOUNTY_HUNTER: Crosshair, CP0: VenetianMask };

function ladderPreview(ladder: string[]): string[] {
  if (ladder.length <= 5) return ladder;
  return [ladder[0], ladder[1], ladder[2], "…", ladder[ladder.length - 1]];
}

function FactionCard({ faction, index }: { faction: (typeof GAME.factions)[number]; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const copy = FACTION_COPY[faction.key];
  const Icon = ICONS[faction.key];
  return (
    <Reveal delay={index * 0.08} className="h-full">
      <TiltCard className="h-full rounded-3xl" max={9}>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
          aria-label={`${copy.name}: ${flipped ? "ver portada" : "ver su camino"}`}
          className="relative block h-[23rem] w-full text-left [perspective:1400px]"
          data-testid="faction-card"
        >
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 110, damping: 15 }}
            style={{ transformStyle: "preserve-3d" }}
            className="relative h-full w-full"
          >
            <div className="glass absolute inset-0 flex flex-col overflow-hidden rounded-3xl p-6 [backface-visibility:hidden]">
              <div aria-hidden className="absolute -top-16 -right-16 h-44 w-44 rounded-full opacity-40 blur-3xl" style={{ background: copy.color }} />
              <span className="grid h-16 w-16 place-items-center rounded-2xl border" style={{ borderColor: `${copy.color}88`, background: `${copy.color}22`, color: copy.color }}>
                <Icon className="h-8 w-8" />
              </span>
              <h3 className="mt-6 text-2xl font-bold text-ink">{copy.name}</h3>
              <p className="mt-2 text-lg leading-snug text-ink-dim italic">{copy.tagline}</p>
              <p className="mt-auto flex items-center gap-2 text-sm text-ink-dim">
                <MapPin className="h-4 w-4 text-gold" /> Empiezas en <b className="text-ink">{faction.start}</b>
              </p>
              <p className="mt-3 font-display text-[0.62rem] tracking-[0.22em] text-gold uppercase">Toca para ver su camino</p>
            </div>
            <div className="absolute inset-0 flex flex-col rounded-3xl border border-gold/30 bg-[#0b1623]/95 p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <p className="font-display text-[0.62rem] tracking-[0.22em] uppercase" style={{ color: copy.color }}>
                {copy.name} · {faction.metric}
              </p>
              <p className="mt-3 text-[0.98rem] leading-snug text-ink">{copy.play}</p>
              <ol className="mt-auto flex flex-col gap-1.5">
                {ladderPreview(faction.ladder).map((rank, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-ink-dim">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: rank === "…" ? "transparent" : copy.color }} />
                    {rank}
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        </button>
      </TiltCard>
    </Reveal>
  );
}

export function Factions() {
  return (
    <div className="relative mx-auto mt-16 max-w-6xl px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {GAME.factions.map((f, i) => (
          <FactionCard key={f.key} faction={f} index={i} />
        ))}
      </div>
    </div>
  );
}

export function Archetypes() {
  return (
    <div>
      <p className="font-display text-[0.7rem] tracking-[0.22em] text-gold uppercase">Cuatro formas de pelear</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {GAME.archetypes.map((a) => (
          <li key={a.name} className="rounded-2xl border border-gold/15 bg-black/20 px-4 py-3">
            <p className="font-display text-sm font-bold text-ink">{a.name}</p>
            <p className="mt-0.5 text-sm leading-snug text-ink-dim">{a.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
