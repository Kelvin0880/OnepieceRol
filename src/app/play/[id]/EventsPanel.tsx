"use client";

import { useCallback, useEffect, useState } from "react";

interface EventView {
  id: string;
  title: string;
  description: string;
  islandName: string;
  here: boolean;
  minLevel: number;
  maxLevel: number;
  status: string;
  rewardText: string;
  participants: { name: string; isNpc: boolean; status: string }[];
  mine: { status: string; score: number | null; verdict: string | null } | null;
  resultText: string | null;
  canJoinReason: string | null;
}

export default function EventsPanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [open, setOpen] = useState<EventView[] | null>(null);
  const [recent, setRecent] = useState<EventView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/events`);
    if (!res.ok) return;
    const d = await res.json();
    setOpen(d.open);
    setRecent(d.recent);
  }, [characterId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  async function act(eventId: string, body: Record<string, unknown>) {
    setBusy(eventId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, ...body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "No se pudo completar.");
      else {
        setNotice((d.log as string[] | undefined)?.join(" ") ?? "Hecho.");
        if (body.op === "submit") setDrafts((x) => ({ ...x, [eventId]: "" }));
        onChanged();
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="events-panel">
      <div className="panel w-full sm:max-w-2xl max-h-[92vh] flex flex-col [&>*]:shrink-0 overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[--line]">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-gold">Eventos</h2>
            <p className="text-xs text-ink-dim">Pruebas abiertas a aventureros. No hay límite de tiempo: termina cuando todos los inscritos completan la prueba.</p>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {notice && <p className="text-sm text-emerald-300" data-testid="events-notice">{notice}</p>}
          {error && <p className="text-sm text-blood" data-testid="events-error">{error}</p>}
          {open && open.length === 0 && <p className="text-sm text-ink-dim" data-testid="events-empty">No hay eventos abiertos ahora mismo. Cada día puede anunciarse uno nuevo: mira las noticias.</p>}
          {open?.map((e) => (
            <section key={e.id} className="rounded border border-[--line] p-3 flex flex-col gap-2" data-testid="event-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-gold-bright">{e.title}</strong>
                <span className="text-xs text-ink-dim">
                  {e.islandName} · niveles {e.minLevel}-{e.maxLevel}
                </span>
              </div>
              <p className="text-sm whitespace-pre-line">{e.description}</p>
              <p className="text-xs text-gold">Premio: {e.rewardText}</p>
              <p className="text-xs text-ink-dim">
                Participantes: {e.participants.map((p) => `${p.name}${p.isNpc ? " (NPC)" : ""}${p.status === "SUBMITTED" ? " ✓" : ""}`).join(", ") || "ninguno todavía"}
              </p>
              {!e.mine && (
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-gold px-3 py-1.5 text-xs" disabled={!!e.canJoinReason || busy === e.id} onClick={() => act(e.id, { op: "join" })} data-testid="event-join">
                    Inscribirme
                  </button>
                  {e.canJoinReason && <span className="text-xs text-ink-dim">{e.canJoinReason}</span>}
                </div>
              )}
              {e.mine?.status === "REGISTERED" && (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full text-sm bg-transparent border border-[--line] rounded px-3 py-2 min-h-24"
                    maxLength={3000}
                    placeholder="Cuenta cómo afrontas la prueba: tu plan, tus habilidades, cómo resuelves los imprevistos…"
                    value={drafts[e.id] ?? ""}
                    onChange={(ev) => setDrafts((x) => ({ ...x, [e.id]: ev.target.value }))}
                    data-testid="event-text"
                  />
                  <div className="flex gap-2 items-center">
                    <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy === e.id || (drafts[e.id] ?? "").trim().length < 20} onClick={() => act(e.id, { op: "submit", text: drafts[e.id] })} data-testid="event-submit">
                      Enviar mi intento
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy === e.id} onClick={() => act(e.id, { op: "withdraw" })}>
                      Retirarme
                    </button>
                  </div>
                </div>
              )}
              {e.mine?.status === "SUBMITTED" && <p className="text-xs text-emerald-300" data-testid="event-waiting">Intento enviado. Esperando a que los demás terminen; el veredicto saldrá en las noticias.</p>}
            </section>
          ))}

          {recent.length > 0 && (
            <section>
              <h3 className="font-display text-gold-bright mb-2">Resultados recientes</h3>
              <ul className="flex flex-col gap-2">
                {recent.map((e) => (
                  <li key={e.id} className="rounded border border-[--line] p-3 text-sm" data-testid="event-result">
                    <strong>{e.title}</strong> <span className="text-xs text-ink-dim">· {e.islandName}</span>
                    <p className="text-xs whitespace-pre-line mt-1">{e.resultText}</p>
                    {e.mine?.score != null && (
                      <p className="text-xs text-gold mt-1">
                        Tu puntuación: {e.mine.score}
                        {e.mine.verdict ? ` — ${e.mine.verdict}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
