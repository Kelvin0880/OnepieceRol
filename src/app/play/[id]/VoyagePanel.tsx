"use client";

import { useCallback, useEffect, useState } from "react";

interface Option {
  islandId: string;
  name: string;
  sea: string;
  hops: number;
  durationMs: number;
  risk: number;
  danger: number;
  blocked: string | null;
}
interface State {
  from: string;
  canSailAnywhere: boolean;
  voyage: { toName: string; fromName: string; arrivesAt: string; msLeft: number } | null;
  options: Option[];
}

const SEA: Record<string, string> = { EAST_BLUE: "East Blue", PARADISE: "Paraíso", NEW_WORLD: "Nuevo Mundo", RED_LINE: "Red Line", CALM_BELT: "Calm Belt", GRAND_LINE: "Grand Line" };

function minutes(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
}

function riskLabel(r: number): { text: string; color: string } {
  if (r === 0) return { text: "Aguas seguras", color: "text-emerald-300" };
  if (r < 25) return { text: `Riesgo bajo · ${r}%`, color: "text-gold" };
  if (r < 45) return { text: `Riesgo alto · ${r}%`, color: "text-orange-300" };
  return { text: `Riesgo extremo · ${r}%`, color: "text-blood" };
}

export default function VoyagePanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/voyage`);
    if (res.ok) setState(await res.json());
  }, [characterId]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  async function sail(o: Option) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "travel", targetIslandId: o.islandId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "No se pudo zarpar.");
      else {
        setNotice((data.log as string[] | undefined)?.join(" ") ?? "Zarpas.");
        setConfirming(null);
        onChanged();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const options = (state?.options ?? []).filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="voyage-panel">
      <div className="panel w-full sm:max-w-2xl max-h-[92vh] flex flex-col [&>*]:shrink-0 overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[--line]">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-gold">Trazar rumbo</h2>
            <p className="text-xs text-ink-dim">
              Estás en <strong className="text-ink" data-testid="voyage-from">{state?.from ?? "…"}</strong>
            </p>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {state?.voyage && (
            <div className="rounded border border-gold/50 p-3 text-sm" data-testid="voyage-active">
              En alta mar: {state.voyage.fromName} → <strong>{state.voyage.toName}</strong>. Llegas en {minutes(state.voyage.msLeft)}.
            </div>
          )}
          {state && !state.canSailAnywhere && (
            <p className="text-sm text-ink-dim">
              Todavía solo puedes cruzar a islas vecinas. Desde el <strong>nivel 20</strong> podrás trazar rumbo a cualquier isla del mundo, con travesías más largas y más peligrosas.
            </p>
          )}
          {state?.canSailAnywhere && (
            <>
              <p className="text-xs text-ink-dim">Cada isla de por medio suma 5 minutos y más riesgo de emboscada en el mar (patrullas, rivales, bestias). Ve preparado: si te alcanzan, tendrás que pelear al llegar a puerto.</p>
              <input className="w-full text-sm bg-transparent border border-[--line] rounded px-3 py-2" placeholder="Buscar isla…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="voyage-search" />
              <ul className="flex flex-col gap-2" data-testid="voyage-list">
                {options.map((o) => {
                  const risk = riskLabel(o.risk);
                  return (
                    <li key={o.islandId} className={`rounded border border-[--line] p-3 ${o.blocked ? "opacity-60" : ""}`} data-testid="voyage-option">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-sm">{o.name}</p>
                          <p className="text-[11px] text-ink-dim">
                            {SEA[o.sea] ?? o.sea} · peligro {o.danger}/10 · {o.hops} {o.hops === 1 ? "salto" : "saltos"}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="text-ink">{o.durationMs === 0 ? "Cruce directo" : minutes(o.durationMs)}</p>
                          <p className={risk.color}>{risk.text}</p>
                        </div>
                      </div>
                      {o.blocked ? (
                        <p className="text-[11px] text-blood mt-1">{o.blocked}</p>
                      ) : confirming === o.islandId ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => sail(o)} data-testid="voyage-confirm">
                            Zarpar a {o.name}
                          </button>
                          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirming(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button className="btn-ghost px-3 py-1.5 text-xs mt-2" disabled={busy || !!state.voyage} onClick={() => setConfirming(o.islandId)} data-testid="voyage-pick">
                          Elegir destino
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {notice && (
            <p className="text-sm text-emerald-300" data-testid="voyage-notice">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-sm text-blood" data-testid="voyage-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
