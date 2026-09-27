"use client";

import { Eye, MapPin, Ship } from "lucide-react";
import type { Character, Island, StateResponse } from "./types";
import { m } from "motion/react";
import { SPRING } from "@/components/motion/presets";

function DangerMeter({ level }: { level: number }) {
  const tone = level >= 8 ? "bg-blood" : level >= 5 ? "bg-orange-400" : "bg-gold";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-dim" title={`Peligro ${level}/10`}>
      Peligro {level}/10
      <span className="inline-flex gap-0.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`w-1 h-2.5 rounded-sm ${i < level ? tone : "bg-black/35"}`} />
        ))}
      </span>
    </span>
  );
}

export default function IslandCard({
  character,
  connectedIslands,
  voyage,
  busy,
  onTravel,
}: {
  character: Character;
  connectedIslands: Island[];
  voyage: StateResponse["voyage"];
  busy: boolean;
  onTravel: (islandId: string) => void;
}) {
  const island = character.currentIsland;
  const isDead = character.status === "DEAD";
  const isImprisoned = character.status === "IMPRISONED";
  const read = JSON.parse(character.poneglyphsRead || "[]") as string[];

  return (
    <m.section
      key={island.id}
      className="panel p-4 overflow-hidden relative"
      data-testid="island-card"
      style={{ transformPerspective: 1200, originX: 0 }}
      initial={{ opacity: 0, rotateY: -28, x: -12 }}
      animate={{ opacity: 1, rotateY: 0, x: 0 }}
      transition={{ ...SPRING.soft, opacity: { duration: 0.3 } }}
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-[0.07] pointer-events-none" style={{ background: "radial-gradient(circle, var(--gold) 0%, transparent 70%)" }} aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-display text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gold" />
          {island.name}
        </h2>
        <DangerMeter level={island.dangerLevel} />
      </div>
      {island.factionControl && <p className="text-[11px] text-gold/80 mb-1">Bajo control de: {island.factionControl}</p>}
      <p className="text-sm text-ink-dim">{island.description}</p>
      {island.poneglyphId && !read.includes(island.poneglyphId) && !isDead && !isImprisoned && (
        <p className="text-xs text-gold mt-3 flex items-start gap-1.5" data-testid="stealth-hint">
          <Eye className="w-4 h-4 shrink-0" />
          Aquí hay un Poneglifo custodiado. Puedes enfrentarte a sus guardianes… o describir cómo te infiltras a escondidas para leerlo sin ser visto (cuesta 15 de estamina; si te descubren, viene el guardián).
        </p>
      )}

      {character.historyStoneHere && !character.historyStoneHere.read && !isDead && !isImprisoned && (
        <p className="text-xs text-gold mt-3 flex items-start gap-1.5" data-testid="history-stone-hint">
          <Eye className="w-4 h-4 shrink-0" />
          Aquí hay un Poneglifo de Historia, a la vista de todos. Ábrelo en «Poneglifos» para leerlo (o hacer un calco si aún no sabes la lengua antigua).
        </p>
      )}

      {voyage && (
        <div className="mt-3 rounded border border-gold/50 bg-gold/5 p-3 text-sm flex items-start gap-2" data-testid="voyage-banner">
          <Ship className="w-4 h-4 text-gold shrink-0 mt-0.5 animate-pulse" />
          <span>
            En alta mar: {voyage.fromName} → <strong>{voyage.toName}</strong>. Llegarás en unos {Math.max(1, Math.ceil(voyage.msLeft / 60000))} min. Hasta entonces no puedes explorar, entrenar ni descansar.
          </span>
        </div>
      )}

      {connectedIslands.length > 0 && !voyage && !isDead && !isImprisoned && !character.pendingEncounter && (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-xs text-ink-dim mb-2">Zarpar hacia:</p>
          <div className="flex flex-wrap gap-2">
            {connectedIslands.map((isl) => (
              <button key={isl.id} className="btn-ghost px-3 py-1.5 text-xs inline-flex items-center gap-1.5" disabled={busy} onClick={() => onTravel(isl.id)} title={`Peligro ${isl.dangerLevel}/10`}>
                <Ship className="w-3.5 h-3.5 opacity-70" />
                {isl.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </m.section>
  );
}
