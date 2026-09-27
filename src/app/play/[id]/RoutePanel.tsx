"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, Circle, Feather, Lock, ScrollText } from "lucide-react";
import Modal from "@/components/ui/Modal";
import StatBar from "@/components/ui/StatBar";
import TabBar from "@/components/motion/TabBar";

interface RouteState {
  script: number;
  scriptLabel: string;
  canStudyHere: boolean;
  studyBlock: string | null;
  road: { id: string; codeName: string; read: boolean; where: string; guardedBy: string | null; lore: string | null }[];
  chapters: { key: string; title: string; islandName: string; known: boolean; text: string | null }[];
  hereHistory: { codeName: string; read: boolean; needs: number } | null;
  rubbings: { id: string; name: string }[];
  crewReaders: { id: string; name: string; script: number }[];
  knowsTruth: boolean;
  steps: { id: string; label: string; done: boolean; detail: string }[];
}

type Tab = "route" | "history" | "road";

export default function RoutePanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [state, setState] = useState<RouteState | null>(null);
  const [tab, setTab] = useState<Tab>("route");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[]>([]);
  const [handTo, setHandTo] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/poneglyphs`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setState(data);
    else setError(data.error ?? "No se pudo cargar.");
  }, [characterId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function op(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNotice([]);
    try {
      const res = await fetch(`/api/characters/${characterId}/poneglyphs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "No se pudo completar.");
      else {
        setNotice(data.log ?? []);
        onChanged();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const known = state?.chapters.filter((c) => c.known).length ?? 0;
  const road = state?.road.filter((r) => r.read).length ?? 0;

  return (
    <Modal onClose={onClose} testId="route-panel" size="lg" label="Ruta a Laugh Tale" className="p-4 gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl text-gold-bright flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Ruta a Laugh Tale
          </h3>
          <p className="text-xs text-ink-dim">La lengua antigua, la historia olvidada y los cuatro Poneglifos de Ruta.</p>
        </div>
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "route", label: "Tu ruta", testId: "route-tab-route" },
          { id: "history", label: `Historia (${known}/${state?.chapters.length ?? 6})`, testId: "route-tab-history" },
          { id: "road", label: `Ruta (${road}/4)`, testId: "route-tab-road" },
        ]}
      />

      {error && <p className="text-blood text-sm" data-testid="route-error">{error}</p>}
      {notice.length > 0 && (
        <div className="rounded border border-jade/40 bg-jade/5 p-3 text-sm flex flex-col gap-1.5 animate-rise" data-testid="route-notice">
          {notice.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
      {!state && !error && <p className="text-sm text-ink-dim">Desenrollando mapas…</p>}

      {state && tab === "route" && (
        <div className="flex flex-col gap-3 animate-fade" data-testid="route-steps">
          <div>
            <StatBar label={`Lengua antigua — ${state.scriptLabel}`} value={state.script} max={100} color="var(--gold)" />
          </div>
          <ol className="flex flex-col gap-2">
            {state.steps.map((s) => (
              <li key={s.id} className={`flex items-start gap-2 rounded border px-3 py-2 ${s.done ? "border-jade/40 bg-jade/5" : "border-line bg-black/10"}`}>
                {s.done ? <Check className="w-4 h-4 text-jade shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-ink-dim shrink-0 mt-0.5" />}
                <span className="text-sm">
                  <span className={s.done ? "text-jade" : "text-gold-bright"}>{s.label}</span>
                  <span className="block text-xs text-ink-dim">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <button className={state.studyBlock ? "btn-ghost px-3 py-1.5 text-xs" : "btn-gold px-3 py-1.5 text-xs"} disabled={busy || !!state.studyBlock} onClick={() => op({ op: "study" })} data-testid="route-study">
              <BookOpen className="w-3.5 h-3.5 inline mr-1" />
              Estudiar la lengua antigua
            </button>
            {state.hereHistory && !state.hereHistory.read && (
              <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => op({ op: "read_history" })} data-testid="route-read-history">
                <Feather className="w-3.5 h-3.5 inline mr-1" />
                {state.script >= state.hereHistory.needs ? "Leer el Poneglifo de esta isla" : "Hacer un calco del Poneglifo de esta isla"}
              </button>
            )}
          </div>
          {state.studyBlock && <p className="text-[11px] text-ink-dim">{state.studyBlock}</p>}

          {state.rubbings.length > 0 && (
            <div className="rounded border border-gold/50 bg-gold/5 p-3 flex flex-col gap-2" data-testid="route-rubbings">
              <p className="text-sm text-gold-bright">Tus calcos</p>
              {state.rubbings.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>📜 {r.name}</span>
                  {state.crewReaders.length > 0 && (
                    <span className="flex items-center gap-1">
                      <select className="bg-black/30 border border-line rounded px-1.5 py-1 text-xs" value={handTo[r.id] ?? ""} onChange={(e) => setHandTo((m) => ({ ...m, [r.id]: e.target.value }))}>
                        <option value="">Dar a…</option>
                        {state.crewReaders.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (lengua {m.script})
                          </option>
                        ))}
                      </select>
                      <button className="btn-ghost px-2 py-1 text-xs" disabled={busy || !handTo[r.id]} onClick={() => op({ op: "hand", rubbingId: r.id, toCharacterId: handTo[r.id] })}>
                        Entregar
                      </button>
                    </span>
                  )}
                </div>
              ))}
              <button className="btn-gold px-3 py-1.5 text-xs self-start" disabled={busy} onClick={() => op({ op: "decipher" })} data-testid="route-decipher">
                Descifrar mis calcos
              </button>
            </div>
          )}
        </div>
      )}

      {state && tab === "history" && (
        <div className="flex flex-col gap-2 animate-fade" data-testid="route-history">
          <p className="text-xs text-ink-dim">Seis Poneglifos de Historia cuentan el siglo que el mundo olvidó. No tienen guardián: basta con llegar a su isla y saber leerlos. Cada capítulo que conozca la coalición debilita al Rey Sin Nombre en el asalto final.</p>
          {state.chapters.map((c) => (
            <div key={c.key} className={`rounded border p-3 ${c.known ? "border-gold/50 bg-gold/5" : "border-line bg-black/10"}`} data-testid="route-chapter">
              <p className="text-sm flex items-center gap-2">
                {c.known ? <Check className="w-4 h-4 text-jade" /> : <Lock className="w-4 h-4 text-ink-dim" />}
                <span className={c.known ? "text-gold-bright font-display" : "text-ink-dim"}>{c.title}</span>
                <span className="text-[11px] text-ink-dim">· {c.islandName}</span>
              </p>
              {c.text && <p className="text-sm text-ink mt-1 italic">{c.text}</p>}
            </div>
          ))}
        </div>
      )}

      {state && tab === "road" && (
        <div className="flex flex-col gap-2 animate-fade" data-testid="route-road">
          <p className="text-xs text-ink-dim">Los cuatro Poneglifos de Ruta señalan Laugh Tale. Cada uno está custodiado por un gran poder: se vence al guardián o se entra a escondidas (describe cómo te infiltras en la isla).</p>
          {state.road.map((r) => (
            <div key={r.id} className={`rounded border p-3 ${r.read ? "border-[#c0392b]/60 bg-[#c0392b]/5" : "border-line bg-black/10"}`}>
              <p className="text-sm flex items-center gap-2">
                {r.read ? <Check className="w-4 h-4 text-jade" /> : <Lock className="w-4 h-4 text-ink-dim" />}
                <span className="font-display text-gold-bright">{r.codeName.replace("Poneglifo de Ruta — ", "")}</span>
                <span className="text-[11px] text-ink-dim">· {r.where}</span>
              </p>
              {r.guardedBy && <p className="text-xs text-ink-dim mt-1">{r.guardedBy}</p>}
              {r.lore && <p className="text-sm italic mt-1">{r.lore}</p>}
            </div>
          ))}
          {state.knowsTruth && <p className="text-sm text-gold-bright">Has estado en Laugh Tale: conoces la Crónica del Mar.</p>}
        </div>
      )}
    </Modal>
  );
}
