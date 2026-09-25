"use client";

import { useEffect, useRef } from "react";
import { Skull, Users } from "lucide-react";
import StatBar from "@/components/ui/StatBar";
import ChatFeed from "@/components/ui/ChatFeed";
import type { JointFightState } from "./types";

export default function JointFightPanel({ jointFight, onOoc }: { jointFight: JointFightState; onOoc: (starter: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [jointFight.messages.length]);
  const active = jointFight.status === "ACTIVE";

  return (
    <section className={`panel panel-danger p-4 animate-rise ${active ? "animate-danger" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-display text-lg text-gold-bright flex items-center gap-2">
          <Users className="w-5 h-5" />
          Pelea en grupo contra {jointFight.enemy.name}
          {jointFight.enemy.isBoss && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-blood text-white tracking-wider inline-flex items-center gap-1">
              <Skull className="w-3 h-3" />
              JEFE
            </span>
          )}
        </h3>
        <span className="text-xs text-ink-dim flex items-center gap-2">
          {active ? `Ronda ${jointFight.round}` : jointFight.status === "WON" ? "Victoria" : "Derrota"}
          <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => onOoc("Sobre esta pelea en grupo (fuera de rol): ")}>
            Fuera de rol
          </button>
        </span>
      </div>
      {jointFight.stakes && <p className="text-xs text-ink-dim mb-2">{jointFight.stakes}</p>}
      <p className="text-sm mb-3">
        Te enfrentas a <span className="text-gold-bright">{jointFight.enemy.name}</span>. Cómo va la pelea lo cuenta el árbitro en la escena.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {jointFight.participants.map((p) => (
          <div key={p.name} className="rounded border border-line/60 bg-black/15 px-2.5 py-2" data-testid="joint-participant">
            {p.isNpc ? <p className="text-sm">{p.name} (NPC)</p> : <StatBar label={p.name} value={p.hp} max={p.maxHp} color="var(--gold)" />}
            <p className={`text-[11px] mt-0.5 ${p.status === "DOWN" ? "text-blood" : p.submitted ? "text-jade" : "text-ink-dim"}`}>
              {p.status === "DOWN" ? "Caído" : p.status === "FLED" ? "Huyó" : !active ? "" : p.isNpc ? "Lucha por su cuenta" : p.submitted ? "Movimiento enviado" : "Falta su movimiento"}
            </p>
          </div>
        ))}
      </div>
      <ChatFeed
        ref={boxRef}
        className="max-h-80 mb-3"
        messages={jointFight.messages.map((m) => ({ id: m.id, text: m.text, author: m.authorName, kind: m.mine ? "mine" : m.isNarrator ? "narrator" : "other" }))}
      />
      {active && jointFight.me?.status === "FIGHTING" && (
        <p className="text-xs text-ink-dim">
          {jointFight.me.submitted
            ? "Movimiento enviado. Esperando a tus aliados: cada quien responde a su ritmo, la ronda se resuelve cuando todos han movido."
            : "Describe tu movimiento abajo (lo que intentas, no lo que consigues). Cuando todos hayáis movido, el árbitro lo lee a la vez. Puedes escribir que huyes: el árbitro decide quién escapa."}
        </p>
      )}
      {active && jointFight.me?.status === "DOWN" && <p className="text-sm text-blood">Estás caído. Tus aliados deciden el desenlace: si vencen, te sacan con vida; si caen, el juez decide tu destino.</p>}
    </section>
  );
}
