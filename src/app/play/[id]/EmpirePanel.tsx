"use client";

import { useCallback, useEffect, useState } from "react";

interface Domain {
  islandId: string;
  islandName: string;
  title: string;
  garrison: number;
  garrisonLabel: string;
  troops: number;
  msUntilFall: number;
  pendingIncome: number | null;
  isOwner: boolean;
  here: boolean;
}
interface Commander {
  id: string;
  name: string;
  role: string;
  epithet: string | null;
  hp: number;
  maxHp: number;
  power: number;
  errand: { kind: string; label: string; msLeft: number; islandName: string | null } | null;
}
interface Errand {
  kind: "patrol" | "tribute" | "scout";
  label: string;
  brief: string;
  durationMs: number;
}
interface State {
  domains: Domain[];
  commanders: Commander[];
  errands: Errand[];
  reports: { text: string; at: string }[];
  crewName: string | null;
}

function span(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h >= 48 ? `${Math.floor(h / 24)} d` : `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

export default function EmpirePanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [pick, setPick] = useState<{ companionId: string; kind: Errand["kind"] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/empire`);
    if (res.ok) setState(await res.json());
  }, [characterId]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  async function send(companionId: string, kind: Errand["kind"], islandId?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/empire`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "errand", companionId, kind, islandId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "No se pudo dar la orden.");
      else {
        setNotice((data.log as string[]).join(" "));
        setPick(null);
        onChanged();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const patrollable = (state?.domains ?? []).filter((d) => d.isOwner && d.garrison < 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="empire-panel">
      <div className="panel w-full sm:max-w-2xl max-h-[92vh] flex flex-col [&>*]:shrink-0 overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[--line]">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-gold">Tu imperio</h2>
            <p className="text-xs text-ink-dim">Dominios, ejército y misiones de tus comandantes{state?.crewName ? ` · ${state.crewName}` : ""}.</p>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {notice && <p className="text-sm text-emerald-300" data-testid="empire-notice">{notice}</p>}
          {error && <p className="text-sm text-blood" data-testid="empire-error">{error}</p>}

          <section>
            <h3 className="font-display text-gold-bright mb-2">Dominios</h3>
            {state && state.domains.length === 0 && <p className="text-sm text-ink-dim">Aún no sostienes ninguna isla. Conquista una desde su panel de dominio.</p>}
            <ul className="flex flex-col gap-2">
              {(state?.domains ?? []).map((d) => (
                <li key={d.islandId} className="rounded border border-[--line] p-3" data-testid="empire-domain">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-ink">{d.islandName}</strong>
                    <span className={`text-xs ${d.garrison < 30 ? "text-blood" : d.garrison < 60 ? "text-orange-300" : "text-emerald-300"}`}>{d.garrisonLabel}</span>
                  </div>
                  <div className="h-2 rounded bg-black/40 mt-2 overflow-hidden">
                    <div className="h-full" style={{ width: `${d.garrison}%`, background: "var(--gold)" }} />
                  </div>
                  <p className="text-xs text-ink-dim mt-2">
                    {d.title} · ⚔ {d.troops.toLocaleString("es-ES")} soldados · guarnición {d.garrison}/100 · si nadie la refuerza cae en {span(d.msUntilFall)}
                  </p>
                  {d.pendingIncome != null && (
                    <p className="text-xs text-ink-dim">Tributos acumulados: ฿ {d.pendingIncome.toLocaleString("es-ES")}{d.here ? " (cóbralos en el panel de la isla)" : " (cóbralos estando en la isla)"}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-display text-gold-bright mb-2">Comandantes y nakamas</h3>
            {state && state.commanders.length === 0 && <p className="text-sm text-ink-dim">No tienes nakamas NPC. Recluta a alguien en una escena para poder darle misiones.</p>}
            <ul className="flex flex-col gap-2">
              {(state?.commanders ?? []).map((c) => (
                <li key={c.id} className="rounded border border-[--line] p-3" data-testid="empire-commander">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="text-ink">{c.name}</strong> <span className="text-xs text-ink-dim">{c.role}{c.epithet ? ` · «${c.epithet}»` : ""}</span>
                    </div>
                    <span className="text-xs text-ink-dim">Poder {c.power} · {c.hp}/{c.maxHp} PV</span>
                  </div>
                  {c.errand ? (
                    <p className="text-sm text-gold mt-2" data-testid="empire-away">
                      En misión: {c.errand.label}{c.errand.islandName ? ` (${c.errand.islandName})` : ""} · vuelve en {span(c.errand.msLeft)}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(state?.errands ?? []).map((e) => (
                        <button
                          key={e.kind}
                          className="btn-ghost px-3 py-1.5 text-xs"
                          disabled={busy || (e.kind === "patrol" && patrollable.length === 0)}
                          title={e.brief}
                          onClick={() => (e.kind === "patrol" ? setPick({ companionId: c.id, kind: e.kind }) : send(c.id, e.kind))}
                          data-testid={`empire-errand-${e.kind}`}
                        >
                          {e.label} ({span(e.durationMs)})
                        </button>
                      ))}
                    </div>
                  )}
                  {pick?.companionId === c.id && (
                    <div className="mt-2 flex flex-wrap gap-2" data-testid="empire-pick-domain">
                      {patrollable.map((d) => (
                        <button key={d.islandId} className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => send(c.id, "patrol", d.islandId)}>
                          Patrullar {d.islandName}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-dim mt-2">Un nakama en misión no combate a tu lado. Si la misión sale mal vuelve herido, nunca muerto.</p>
          </section>

          {state && state.reports.length > 0 && (
            <section>
              <h3 className="font-display text-gold-bright mb-2">Informes</h3>
              <ul className="text-xs text-ink-dim flex flex-col gap-1" data-testid="empire-reports">
                {state.reports.map((r, i) => (
                  <li key={i}>{r.text}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
