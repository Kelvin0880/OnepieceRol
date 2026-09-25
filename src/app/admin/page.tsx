"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import BackToCharacter from "@/components/ui/BackToCharacter";

interface AdminArc {
  id: string;
  title: string;
  kind: string;
  status: string;
  consent: string;
  stage: number;
  totalStages: number;
  target: string;
  aggressor: string | null;
  nextBeatAt: string;
  story: string[];
  proposal: string;
}

/**
 * Owner-only page. The AI never decides that a canon character dies or is captured: after a long build-up of
 * chapters, the arc stops here and waits for this answer. Approving is irreversible; denying always means survival.
 */
export default function AdminPage() {
  const [arcs, setArcs] = useState<AdminArc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; approve: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/world-arcs");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "No se pudo cargar.");
      setArcs(null);
      return;
    }
    setError(null);
    setArcs(d.arcs);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/world-arcs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "No se pudo completar.");
      else {
        setError(null);
        if (d.headline) setNotice(`Desenlace publicado: «${d.headline}»`);
      }
      setConfirm(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-gold-bright">Administración del mundo</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/news" className="btn-ghost px-3 py-1.5 text-sm">
            Volver a noticias
          </Link>
          <BackToCharacter />
        </div>
      </div>
      <p className="text-sm text-ink-dim">
        Aquí decides el destino de los personajes canon. La IA construye la historia poco a poco, pero <strong>nunca mata ni captura a nadie por su cuenta</strong>:
        al llegar al momento decisivo se detiene y te pregunta.
      </p>

      {error && (
        <p className="text-blood text-sm" data-testid="admin-error">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-gold text-sm" data-testid="admin-notice">
          {notice}
        </p>
      )}
      {arcs && arcs.length === 0 && <p className="text-ink-dim" data-testid="admin-empty">No hay eventos mundiales abiertos ahora mismo.</p>}

      {arcs?.map((a) => (
        <div key={a.id} className="panel p-4 flex flex-col gap-3" data-testid="admin-arc">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-gold-bright">{a.title}</h2>
            <span className="text-xs uppercase tracking-wide text-orange-300">
              {a.status === "AWAITING_CONSENT" ? "Esperando tu decisión" : `Capítulo ${a.stage}/${a.totalStages}`}
            </span>
          </div>
          <div>
            <p className="text-xs text-ink-dim mb-1">La historia hasta ahora:</p>
            {a.story.length === 0 && <p className="text-xs text-ink-dim">Aún no se ha publicado ningún capítulo.</p>}
            <ol className="text-sm flex flex-col gap-1 list-decimal pl-5">
              {a.story.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </div>

          {a.status === "AWAITING_CONSENT" && (
            <div className="rounded border-2 border-blood p-3 flex flex-col gap-2" style={{ background: "rgba(120,20,20,0.15)" }} data-testid="admin-proposal">
              <p className="font-display text-base text-gold-bright">{a.proposal}</p>
              <p className="text-xs text-ink-dim">
                Si aceptas, la IA narrará el desenlace como un hecho definitivo del mundo. Si rechazas, {a.target} sobrevive: escapa contra todo pronóstico. En ambos casos se publica el desenlace con sus consecuencias.
              </p>
              {confirm?.id === a.id ? (
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-sm text-blood">{confirm.approve ? "Esto es irreversible. ¿Confirmas?" : `¿Confirmas que ${a.target} sobreviva?`}</span>
                  <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => send({ op: "decide", arcId: a.id, approve: confirm.approve })} data-testid="admin-confirm">
                    Sí, confirmar
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirm(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirm({ id: a.id, approve: true })} data-testid="admin-approve">
                    Permitirlo
                  </button>
                  <button className="btn-gold px-3 py-1.5 text-xs" onClick={() => setConfirm({ id: a.id, approve: false })} data-testid="admin-deny">
                    No permitirlo (sobrevive)
                  </button>
                </div>
              )}
            </div>
          )}

          {a.status === "ACTIVE" && (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-ink-dim">Próximo capítulo: {new Date(a.nextBeatAt).toLocaleString("es-ES")}</span>
              <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => send({ op: "advance", arcId: a.id })} data-testid="admin-advance">
                Adelantar capítulo
              </button>
              <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => send({ op: "cancel", arcId: a.id })}>
                Cancelar evento
              </button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
