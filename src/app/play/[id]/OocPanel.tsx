"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Overview {
  tone: string;
  notes: string | null;
  pact: string | null;
  isCaptain: boolean;
  crewName: string | null;
  rollbacksLeft: number;
  checkpoints: { id: string; kind: string; label: string; createdAt: string }[];
}

type Proposal = { type: string; [k: string]: unknown };

const PROPOSAL_LABELS: Record<string, string> = {
  rename: "Cambiar el nombre del personaje",
  rename_crew: "Cambiar el nombre de la tripulación",
  undo_last: "Deshacer la última respuesta del narrador",
  rollback: "Volver al último punto de restauración",
  repair: "Reparar valores inválidos",
  set_tone: "Cambiar el tono del narrador",
  add_note: "Guardar una indicación para el narrador",
  clear_notes: "Borrar las indicaciones guardadas",
  report: "Enviar el reporte",
  set_pact: "Guardar el pacto de escena",
  clear_pact: "Borrar el pacto de escena",
};

const TONES: { id: string; label: string; help: string }[] = [
  { id: "balanced", label: "Equilibrado", help: "Cada enemigo actúa según su carácter: unos matan, otros intimidan, capturan o negocian." },
  { id: "lethal", label: "Letal", help: "Mundo duro: casi todos combaten a muerte y nadie perdona." },
  { id: "story", label: "Historia", help: "Más drama y trato: enemigos con motivos que negocian, se burlan o se retiran." },
];

function describeProposal(p: Proposal): string {
  const base = PROPOSAL_LABELS[p.type] ?? p.type;
  const detail = typeof p.name === "string" ? `: ${p.name}` : typeof p.tone === "string" ? `: ${p.tone}` : typeof p.note === "string" ? `: «${p.note}»` : typeof p.text === "string" ? `: «${p.text}»` : "";
  return base + detail;
}

/**
 * Out-of-role toolbox. Opened from the header and from contextual "Fuera de rol"
 * buttons around the app; `starter` pre-fills the chat so the entry point says what
 * the player probably wants ("el narrador repitió mi acción", "quiero pactar un 4 vs 4"...).
 */
export default function OocPanel({
  characterId,
  starter,
  onClose,
  onChanged,
  onRestoreText,
}: {
  characterId: string;
  starter?: string;
  onClose: () => void;
  onChanged: () => void;
  onRestoreText: (text: string) => void;
}) {
  const [tab, setTab] = useState<"chat" | "tools" | "points">("chat");
  const [ov, setOv] = useState<Overview | null>(null);
  // Ephemeral by design: nothing is stored server-side, closing the panel wipes the chat.
  const [chat, setChat] = useState<{ role: "player" | "assistant"; text: string }[]>([]);
  const [text, setText] = useState(starter ?? "");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [crewDraft, setCrewDraft] = useState("");
  const [pactDraft, setPactDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [reportDraft, setReportDraft] = useState("");
  const [pointDraft, setPointDraft] = useState("");
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/ooc`);
    if (res.ok) setOv(await res.json());
  }, [characterId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.length, busy]);

  async function post(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/characters/${characterId}/ooc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(result.error ?? "No se pudo completar.");
      return null;
    }
    return result;
  }

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setProposal(null);
    setNotice(null);
    const history = chat.slice(-6);
    setChat((c) => [...c, { role: "player", text: t }]);
    setText("");
    try {
      const r = await post({ op: "chat", text: t, history });
      if (r) {
        setChat((c) => [...c, { role: "assistant", text: r.reply }]);
        if (r.proposal) setProposal(r.proposal);
      }
    } finally {
      setBusy(false);
    }
  }

  async function apply(action: Proposal) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await post({ op: "apply", action });
      if (r) {
        setNotice(r.message);
        if (r.restoredText) onRestoreText(r.restoredText);
        setProposal(null);
        onChanged();
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function doRollback(checkpointId?: string) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await post({ op: "rollback", checkpointId });
      if (r) {
        setNotice(r.message);
        setConfirmRollback(null);
        onChanged();
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function savePoint() {
    const label = pointDraft.trim();
    if (!label) return;
    setBusy(true);
    try {
      const r = await post({ op: "checkpoint", label });
      if (r) {
        setNotice(r.message);
        setPointDraft("");
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (id: typeof tab, label: string) => (
    <button key={id} className={`px-3 py-1.5 text-sm rounded ${tab === id ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab(id)}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose} data-testid="ooc-panel">
      <div className="panel p-4 w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-xl text-gold-bright">Fuera de rol</h3>
            <p className="text-xs text-ink-dim">Aquí hablas tú, no tu personaje. Nada de esto entra en la historia ni se guarda: sirve para corregir, ajustar, pactar y preguntar cómo funciona el juego.</p>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onClose}>
            Volver al rol
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {tabBtn("chat", "Hablar con la IA")}
          {tabBtn("tools", "Herramientas")}
          {tabBtn("points", "Puntos de restauración")}
        </div>

        {notice && <p className="text-sm text-gold" data-testid="ooc-notice">{notice}</p>}
        {error && <p className="text-sm text-blood" data-testid="ooc-error">{error}</p>}

        {tab === "chat" && (
          <div className="flex flex-col gap-2">
            <div className="rounded border border-white/10 p-2 max-h-[38vh] overflow-y-auto flex flex-col gap-2" data-testid="ooc-chat">
              {chat.length === 0 && (
                <p className="text-xs text-ink-dim">
                  Cuéntame qué pasó («el narrador repitió mi acción», «somos 4 y queremos un 4 vs 4 amistoso»…) o pregúntame cómo funciona algo («¿cómo subo de nivel?», «¿para qué sirve la fatiga?»). Puedo proponerte una herramienta y tú decides si la aplicas. Este chat no se guarda.
                </p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`text-sm rounded px-2 py-1.5 max-w-[88%] whitespace-pre-line ${m.role === "player" ? "self-end bg-white/10" : "self-start border border-white/10"}`}>
                  {m.text}
                </div>
              ))}
              {busy && <p className="text-xs text-ink-dim">pensando…</p>}
              <div ref={endRef} />
            </div>
            {proposal && (
              <div className="rounded border border-gold/40 p-2 flex flex-col gap-2" data-testid="ooc-proposal">
                <p className="text-sm">
                  <span className="text-gold-bright">Propuesta:</span> {describeProposal(proposal)}
                </p>
                <div className="flex gap-2">
                  <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => apply(proposal)} data-testid="ooc-apply">
                    Aplicar
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setProposal(null)}>
                    No, gracias
                  </button>
                </div>
              </div>
            )}
            <textarea
              className="input w-full min-h-[70px]"
              placeholder="Habla con la IA fuera de rol…"
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
              }}
              data-testid="ooc-input"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-ink-dim">Ctrl+Enter para enviar</span>
              <button className="btn-gold px-4 py-2 text-sm" disabled={busy || !text.trim()} onClick={send} data-testid="ooc-send">
                Enviar
              </button>
            </div>
          </div>
        )}

        {tab === "tools" && ov && (
          <div className="flex flex-col gap-4">
            <section>
              <h4 className="font-display text-sm text-ink-dim mb-1">Tono del narrador</h4>
              <div className="flex flex-col gap-1">
                {TONES.map((t) => (
                  <button key={t.id} className={`text-left rounded px-3 py-2 border ${ov.tone === t.id ? "border-gold" : "border-white/10"}`} disabled={busy} onClick={() => apply({ type: "set_tone", tone: t.id })} data-testid={`ooc-tone-${t.id}`}>
                    <span className="text-sm text-gold-bright">{t.label}{ov.tone === t.id ? " (actual)" : ""}</span>
                    <span className="block text-xs text-ink-dim">{t.help}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h4 className="font-display text-sm text-ink-dim mb-1">Nombres</h4>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Nuevo nombre del personaje" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} data-testid="ooc-name" />
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !nameDraft.trim()} onClick={() => apply({ type: "rename", name: nameDraft }).then(() => setNameDraft(""))}>
                  Renombrar
                </button>
              </div>
              {ov.crewName && ov.isCaptain && (
                <div className="flex gap-2 mt-2">
                  <input className="input flex-1" placeholder={`Nuevo nombre para ${ov.crewName}`} value={crewDraft} onChange={(e) => setCrewDraft(e.target.value)} />
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !crewDraft.trim()} onClick={() => apply({ type: "rename_crew", name: crewDraft }).then(() => setCrewDraft(""))}>
                    Renombrar tripulación
                  </button>
                </div>
              )}
            </section>

            <section>
              <h4 className="font-display text-sm text-ink-dim mb-1">Indicaciones permanentes para el narrador</h4>
              {ov.notes ? <p className="text-xs text-gold mb-1 whitespace-pre-line" data-testid="ooc-notes">{ov.notes}</p> : <p className="text-xs text-ink-dim mb-1">Ninguna todavía. Ejemplo: «no repitas mi acción», «los NPC hablan corto».</p>}
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Nueva indicación" value={noteDraft} maxLength={400} onChange={(e) => setNoteDraft(e.target.value)} data-testid="ooc-note-input" />
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !noteDraft.trim()} onClick={() => apply({ type: "add_note", note: noteDraft }).then(() => setNoteDraft(""))} data-testid="ooc-note-add">
                  Guardar
                </button>
                {ov.notes && (
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => apply({ type: "clear_notes" })}>
                    Borrar
                  </button>
                )}
              </div>
            </section>

            <section>
              <h4 className="font-display text-sm text-ink-dim mb-1">Pacto de escena (versus, montajes, torneos)</h4>
              <p className="text-xs text-ink-dim mb-1">
                Acordad aquí lo que queréis vivir y el narrador lo monta dentro del rol, con todos los presentes. Ejemplo: «Somos 4: haremos un 4 vs 4 amistoso en la plaza, con público y apuestas».
              </p>
              {ov.pact && <p className="text-xs text-gold mb-1" data-testid="ooc-pact">Pacto actual: {ov.pact}</p>}
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Describe el pacto" value={pactDraft} maxLength={600} onChange={(e) => setPactDraft(e.target.value)} data-testid="ooc-pact-input" />
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !pactDraft.trim()} onClick={() => apply({ type: "set_pact", text: pactDraft }).then(() => setPactDraft(""))} data-testid="ooc-pact-set">
                  Pactar
                </button>
                {ov.pact && (
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => apply({ type: "clear_pact" })}>
                    Quitar
                  </button>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="font-display text-sm text-ink-dim">Arreglos rápidos</h4>
              <div className="flex gap-2 flex-wrap">
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => apply({ type: "undo_last" })} data-testid="ooc-undo">
                  Deshacer última respuesta
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => apply({ type: "repair" })} data-testid="ooc-repair">
                  Reparar valores / desatascar
                </button>
              </div>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Reportar un fallo (se guarda con tu estado y la escena)" value={reportDraft} maxLength={1000} onChange={(e) => setReportDraft(e.target.value)} data-testid="ooc-report-input" />
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !reportDraft.trim()} onClick={() => apply({ type: "report", text: reportDraft }).then(() => setReportDraft(""))} data-testid="ooc-report-send">
                  Reportar
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === "points" && ov && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-ink-dim">
              Un punto guarda tus números (nivel, vida, aguante, stats, isla). No devuelve equipo ni revive a nadie: la muerte es permanente. Rollbacks disponibles hoy:{" "}
              <span className="text-gold-bright" data-testid="ooc-rollbacks-left">{ov.rollbacksLeft}</span>.
            </p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Nombre del punto (ej. antes del jefe)" value={pointDraft} maxLength={60} onChange={(e) => setPointDraft(e.target.value)} data-testid="ooc-point-input" />
              <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy || !pointDraft.trim()} onClick={savePoint} data-testid="ooc-point-save">
                Guardar punto
              </button>
            </div>
            {ov.checkpoints.length === 0 && <p className="text-xs text-ink-dim">Aún no hay puntos.</p>}
            <div className="flex flex-col gap-1" data-testid="ooc-points">
              {ov.checkpoints.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-2 rounded border border-white/10 px-2 py-1.5">
                  <div>
                    <p className="text-sm">{k.label}</p>
                    <p className="text-[11px] text-ink-dim">{new Date(k.createdAt).toLocaleString("es-ES")} · {k.kind === "manual" ? "manual" : "automático"}</p>
                  </div>
                  {confirmRollback === k.id ? (
                    <div className="flex gap-1">
                      <button className="btn-gold px-2 py-1 text-xs" disabled={busy} onClick={() => doRollback(k.id)} data-testid="ooc-rollback-confirm">
                        Sí, volver
                      </button>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirmRollback(null)}>
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button className="btn-ghost px-2 py-1 text-xs" disabled={busy || ov.rollbacksLeft === 0} onClick={() => setConfirmRollback(k.id)} data-testid="ooc-rollback">
                        Volver aquí
                      </button>
                      {k.kind === "manual" && (
                        <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => post({ op: "delete_checkpoint", checkpointId: k.id }).then(reload)}>
                          Borrar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
