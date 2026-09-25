"use client";

import { useEffect, useRef, useState } from "react";
import { Swords } from "lucide-react";
import StatBar from "@/components/ui/StatBar";
import ChatFeed from "@/components/ui/ChatFeed";
import type { DuelState } from "./types";

export default function DuelPanel({
  duel,
  characterId,
  busy,
  doDuelOp,
  onOoc,
}: {
  duel: DuelState;
  characterId: string;
  busy: boolean;
  doDuelOp: (body: Record<string, unknown>) => Promise<void>;
  onOoc: (starter: string) => void;
}) {
  const [fleeOpen, setFleeOpen] = useState(false);
  const [fleeText, setFleeText] = useState("");
  const [confirmYield, setConfirmYield] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [duel.messages.length]);

  const fleeBox = (placeholder: string) => (
    <div className="mt-2 flex flex-col gap-2 animate-rise" data-testid="duel-flee-box">
      <textarea className="field w-full text-sm px-3 py-2 min-h-20" placeholder={placeholder} value={fleeText} onChange={(e) => setFleeText(e.target.value)} data-testid="duel-flee-text" />
      <button
        className="btn-gold px-3 py-1.5 text-xs self-start"
        disabled={busy || fleeText.trim().length < 5}
        onClick={async () => {
          await doDuelOp({ op: "flee", duelId: duel.id, text: fleeText.trim() });
          setFleeText("");
          setFleeOpen(false);
        }}
        data-testid="duel-flee-send"
      >
        Enviar intento de huida
      </button>
    </div>
  );

  return (
    <section className={`panel p-4 animate-rise ${duel.lethal ? "panel-danger" : "panel-accent"} ${duel.lethal && duel.status === "ACTIVE" ? "animate-danger" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-display text-lg text-gold-bright flex items-center gap-2">
          <Swords className="w-5 h-5" />
          {duel.hostile ? "Caza" : "Duelo"} contra {duel.opponentName}
          {duel.lethal && <span className="text-[10px] px-2 py-0.5 rounded bg-blood text-white tracking-wider">A MUERTE</span>}
        </h3>
        <span className="text-xs text-ink-dim flex items-center gap-2">
          {duel.status === "PROPOSED" ? "Reto pendiente" : duel.status === "ACTIVE" ? `Ronda ${duel.round}` : "Terminado"}
          <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => onOoc("Sobre este duelo (fuera de rol): ")}>
            Fuera de rol
          </button>
        </span>
      </div>
      {duel.status !== "PROPOSED" && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <StatBar label="Tú" value={duel.me.hp} max={duel.me.maxHp} color="var(--blood)" />
            {duel.status === "ACTIVE" && <p className={`text-[11px] mt-0.5 ${duel.me.submitted ? "text-jade" : "text-ink-dim"}`}>{duel.me.submitted ? "Movimiento enviado" : "Falta tu movimiento"}</p>}
          </div>
          <div>
            <StatBar label={duel.opponentName} value={duel.opponent.hp} max={duel.opponent.maxHp} color="var(--blood)" />
            {duel.status === "ACTIVE" && <p className={`text-[11px] mt-0.5 ${duel.opponent.submitted ? "text-jade" : "text-ink-dim"}`}>{duel.opponent.submitted ? "Ya movió" : "Pensando su movimiento..."}</p>}
          </div>
        </div>
      )}
      <ChatFeed
        ref={boxRef}
        className="max-h-72 mb-3"
        messages={duel.messages.map((m) => ({ id: m.id, text: m.text, author: m.authorName, kind: m.mine ? "mine" : m.isNarrator ? "narrator" : "other" }))}
      />
      {duel.status === "PROPOSED" && !duel.isChallenger && (
        <div>
          {duel.hostile && <p className="text-sm text-blood mb-2">¡Te están dando caza! Si huyes, se decide por velocidad: puedes escapar… o que te alcancen.</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold px-4 py-2 text-sm" disabled={busy} onClick={() => doDuelOp({ op: "respond", duelId: duel.id, accept: true })}>
              {duel.hostile ? "Plantar cara" : duel.lethal ? "Aceptar duelo a muerte" : "Aceptar duelo"}
            </button>
            {duel.hostile ? (
              <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={() => setFleeOpen((v) => !v)} data-testid="hunt-flee">
                Intentar huir
              </button>
            ) : (
              <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={() => doDuelOp({ op: "respond", duelId: duel.id, accept: false })}>
                Rechazar
              </button>
            )}
          </div>
        </div>
      )}
      {duel.status === "PROPOSED" && !duel.isChallenger && duel.hostile && fleeOpen && !duel.resolution && fleeBox("Describe cómo intentas escapar de la caza…")}
      {duel.status === "PROPOSED" && duel.isChallenger && (
        <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={() => doDuelOp({ op: "cancel", duelId: duel.id })}>
          Cancelar reto
        </button>
      )}
      {duel.status === "ACTIVE" && !duel.resolution && (
        <div data-testid="duel-controls">
          <p className="text-xs text-ink-dim">
            Describe tu movimiento abajo: cómo atacas y cómo te defiendes (lo que intentas, no lo que consigues). Cuando ambos hayáis movido, el árbitro lee las dos acciones a la vez y decide cuánta vida y aguante pierde cada uno. Solo te hieren si tu propio texto lo permite.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {!confirmYield ? (
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setConfirmYield(true)} data-testid="duel-yield">
                Perdí
              </button>
            ) : (
              <>
                <button
                  className="btn-gold px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => {
                    setConfirmYield(false);
                    doDuelOp({ op: "yield", duelId: duel.id });
                  }}
                  data-testid="duel-yield-confirm"
                >
                  Sí, me doy por vencido
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirmYield(false)}>
                  Seguir peleando
                </button>
              </>
            )}
            {duel.lethal && (
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setFleeOpen((v) => !v)} data-testid="duel-flee">
                Intentar huir
              </button>
            )}
          </div>
          {duel.lethal && fleeOpen && fleeBox("Describe cómo intentas escapar…")}
          {duel.lethal && <p className="text-[11px] text-ink-dim mt-2">Es a muerte: si te rindes, tu vencedor decide tu destino; si intentas huir, tu rival decide si te deja. Lo pactado entre vosotros fuera del juego es lo que manda.</p>}
        </div>
      )}
      {(duel.status === "ACTIVE" || duel.status === "PROPOSED") && duel.resolution === "FLEE_PLEA" && (
        <div className="rounded border border-gold/50 p-3 animate-rise" data-testid="duel-flee-plea">
          {duel.pleaByMe ? (
            <p className="text-sm">Has intentado huir. Esperando a que {duel.opponentName} decida si te deja escapar…</p>
          ) : (
            <>
              <p className="text-sm mb-2">
                <strong>{duel.opponentName}</strong> intenta huir: <em>{duel.pleaText}</em>
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "flee_decide", duelId: duel.id, allow: true })} data-testid="duel-flee-allow">
                  Permitir la huida
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "flee_decide", duelId: duel.id, allow: false })} data-testid="duel-flee-deny">
                  Impedirla (el duelo sigue)
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {duel.status === "ACTIVE" && duel.resolution === "VERDICT" && (
        <div className="rounded border border-blood/60 p-3 animate-rise" data-testid="duel-verdict">
          {duel.verdict ? (
            <>
              <p className="text-sm mb-2">{duel.opponentName} ha caído o se ha rendido. Tú decides su destino (lo acordado fuera del juego manda):</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "verdict", duelId: duel.id, choice: "kill" })} data-testid="duel-kill">
                  Matar
                </button>
                {duel.verdict.canCapture && (
                  <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "verdict", duelId: duel.id, choice: "capture" })} data-testid="duel-capture">
                    {duel.verdict.captureLabel}
                  </button>
                )}
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "verdict", duelId: duel.id, choice: "spare" })} data-testid="duel-spare">
                  Perdonar la vida
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm">Estás a merced de {duel.opponentName}. Esperando su decisión…</p>
          )}
        </div>
      )}
      {duel.status === "FINISHED" && (
        <p className="text-sm text-gold-bright font-display animate-pop">
          {duel.winnerId === characterId ? "¡Has ganado el duelo!" : duel.winnerId ? "Has perdido el duelo." : "El duelo terminó sin vencedor: la huida fue permitida."}
        </p>
      )}
    </section>
  );
}
