"use client";

import Modal from "@/components/ui/Modal";
import { useCallback, useEffect, useState } from "react";

interface State {
  onDressrosa: boolean;
  lastChampion: string | null;
  tournament: {
    id: string;
    kind: string;
    kindLabel: string;
    status: "ANNOUNCED" | "RUNNING" | "FINISHED" | "CANCELLED";
    prize: { kind: string; label: string; fruitName?: string };
    startsAt: string;
    roundEndsAt: string | null;
    round: number;
    size: number;
    totalRounds: number;
    roundLabel: string | null;
    championName: string | null;
    registered: string[];
    bracket: { label: string; matches: { a: string; b: string; winner: string | null; walkover: boolean; aHp: number | null; bHp: number | null }[] }[];
  } | null;
  canRegister?: boolean;
  reason?: string | null;
  me?: { status: string; strategy: string | null; opponent: string | null; roundOut: number | null } | null;
}

function countdown(iso: string | null, now: number): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "ahora mismo";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `en ${m} min`;
  return `en ${Math.floor(m / 60)} h ${m % 60} min`;
}

export default function ColiseumPanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/coliseum`);
    if (res.ok) setState(await res.json());
  }, [characterId]);
  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      refresh();
      setNow(Date.now());
    }, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  async function act(body: unknown) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/coliseum`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? "No se pudo.");
      setNotice(out.message ?? "Hecho.");
      await refresh();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  const t = state?.tournament ?? null;
  const prizeColor = t?.prize.kind === "fruit" ? "#c9a7f5" : undefined;

  return (
    <Modal onClose={onClose} testId="coliseum-panel" size="lg" label="Coliseo" className="p-4 gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl text-gold-bright">Coliseo de Dressrosa</h3>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {notice && (
          <p className="text-sm text-gold" data-testid="coliseum-notice">
            {notice}
          </p>
        )}
        {error && (
          <p className="text-sm text-blood" data-testid="coliseum-error">
            {error}
          </p>
        )}
        {!state && <p className="text-sm text-ink-dim">Consultando el cartel del coliseo…</p>}
        {state && !t && (
          <div className="text-sm text-ink-dim" data-testid="coliseum-none">
            <p>No hay ningún torneo convocado. El coliseo abre uno de vez en cuando: se anuncia en Noticias horas antes, con el premio.</p>
            {state.lastChampion && <p className="mt-2">Último campeón: <span className="text-gold-bright">{state.lastChampion}</span></p>}
          </div>
        )}

        {t && (
          <>
            <section className="rounded border border-gold/40 p-3" data-testid="coliseum-header">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-lg text-gold-bright">{t.kindLabel}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-black/40" data-testid="coliseum-status">
                  {t.status === "ANNOUNCED" ? "Inscripción abierta" : t.status === "RUNNING" ? `En curso · ${t.roundLabel}` : t.status === "FINISHED" ? "Terminado" : "Cancelado"}
                </span>
              </div>
              <p className="text-sm mt-1">
                Premio para el campeón: <strong style={{ color: prizeColor }} data-testid="coliseum-prize">{t.prize.label}</strong>
              </p>
              {t.status === "ANNOUNCED" && <p className="text-xs text-ink-dim">Empieza {countdown(t.startsAt, now)}. Emparejamientos totalmente aleatorios; combates no letales.</p>}
              {t.status === "RUNNING" && <p className="text-xs text-ink-dim">Siguiente ronda {countdown(t.roundEndsAt, now)}.</p>}
              {t.status === "FINISHED" && t.championName && <p className="text-sm text-gold-bright">Campeón: {t.championName}</p>}
            </section>

            {t.status === "ANNOUNCED" && (
              <section className="flex flex-col gap-2" data-testid="coliseum-register">
                <p className="text-xs text-ink-dim">Inscritos (aventureros): {t.registered.length ? t.registered.join(", ") : "nadie todavía"}. Los huecos los cubren gladiadores de Dressrosa.</p>
                {state?.me && state.me.status === "REGISTERED" ? (
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-sm text-gold">Estás inscrito. No salgas de Dressrosa.</span>
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => act({ op: "withdraw" })}>
                      Retirarme
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <button className="btn-gold px-3 py-1.5 text-sm self-start" disabled={busy || !state?.canRegister} onClick={() => act({ op: "register" })} data-testid="coliseum-register-btn">
                      Inscribirme
                    </button>
                    {!state?.canRegister && state?.reason && <p className="text-xs text-blood">{state.reason}</p>}
                  </div>
                )}
              </section>
            )}

            {t.status === "RUNNING" && state?.me && (
              <section className="rounded border border-white/10 p-3 flex flex-col gap-2" data-testid="coliseum-me">
                {state.me.status === "ACTIVE" && (
                  <>
                    <p className="text-sm">
                      Tu próximo combate: <strong className="text-gold-bright">{state.me.opponent ?? "por sortear"}</strong>
                    </p>
                    <p className="text-xs text-ink-dim">Cuéntale al público cómo piensas ganar (máx. 300 letras): el árbitro tendrá en cuenta tu táctica al juzgar el combate. Debes seguir en Dressrosa.</p>
                    <textarea className="input min-h-[70px]" maxLength={300} value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder={state.me.strategy ?? "Ej: aguanto la primera embestida y contraataco al costado."} data-testid="coliseum-strategy" />
                    <button className="btn-gold px-3 py-1.5 text-sm self-start" disabled={busy || !strategy.trim()} onClick={() => act({ op: "strategy", text: strategy }).then(() => setStrategy(""))} data-testid="coliseum-strategy-send">
                      Guardar estrategia
                    </button>
                    {state.me.strategy && <p className="text-[11px] text-ink-dim">Estrategia guardada: «{state.me.strategy}»</p>}
                  </>
                )}
                {state.me.status === "ELIMINATED" && <p className="text-sm text-blood">Quedaste eliminado en {t.bracket[(state.me.roundOut ?? 1) - 1]?.label ?? "una ronda anterior"}.</p>}
                {state.me.status === "CHAMPION" && <p className="text-sm text-gold-bright">¡Eres el campeón!</p>}
              </section>
            )}

            {t.bracket.length > 0 && (
              <section className="flex flex-col gap-3" data-testid="coliseum-bracket">
                {t.bracket.map((r, i) => (
                  <div key={i}>
                    <h4 className="font-display text-sm text-ink-dim mb-1">{r.label}</h4>
                    <div className="flex flex-col gap-1">
                      {r.matches.map((m, j) => (
                        <div key={j} className="rounded border border-white/10 px-2 py-1 text-sm flex flex-wrap items-center gap-x-2">
                          <span className={m.winner === m.a ? "text-gold-bright" : m.winner ? "text-ink-dim line-through" : ""}>{m.a}</span>
                          <span className="text-[11px] text-ink-dim">vs</span>
                          <span className={m.winner === m.b ? "text-gold-bright" : m.winner ? "text-ink-dim line-through" : ""}>{m.b}</span>
                          {m.winner && <span className="text-[11px] text-ink-dim ml-auto">{m.walkover ? "sin combatir" : `${m.a} ${m.aHp}% · ${m.b} ${m.bHp}%`}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
    </Modal>
  );
}
