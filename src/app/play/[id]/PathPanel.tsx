"use client";

import { useCallback, useEffect, useState } from "react";
import { Milestone, ArrowRight } from "lucide-react";
import Modal from "@/components/ui/Modal";
import StatBar from "@/components/ui/StatBar";
import type { PanelKey } from "./PlayHeader";

interface PathStep {
  id: string;
  title: string;
  detail: string;
  panel: string;
  urgent?: boolean;
}

interface PathState {
  rank: { title: string; next: string | null; metric: string; remaining: number | null; fraction: number };
  steps: PathStep[];
}

// "Mi camino" only points at panels the header actually exposes; anything else (missions, scene, prison) lives inline in the main screen, so it just closes there.
const GOES_TO: Partial<Record<string, PanelKey>> = { power: "power", route: "route", crew: "crew", voyage: "voyage", inventory: "inventory", events: "events" };

export default function PathPanel({ characterId, onClose, onOpen }: { characterId: string; onClose: () => void; onOpen: (p: PanelKey) => void }) {
  const [state, setState] = useState<PathState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/path`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setState(data);
    else setError(data.error ?? "No se pudo calcular tu camino.");
  }, [characterId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function go(step: PathStep) {
    const target = GOES_TO[step.panel];
    if (target) onOpen(target);
    else onClose();
  }

  return (
    <Modal onClose={onClose} testId="path-panel" size="lg" label="Mi camino" className="p-4 gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl text-gold-bright flex items-center gap-2">
            <Milestone className="w-5 h-5" />
            Mi camino
          </h3>
          <p className="text-xs text-ink-dim">Lo siguiente que vale la pena hacer, según tu estado real.</p>
        </div>
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
          Cerrar
        </button>
      </div>

      {error && <p className="text-blood text-sm" data-testid="path-error">{error}</p>}
      {!state && !error && <p className="text-sm text-ink-dim">Calculando tu camino…</p>}

      {state && (
        <div className="flex flex-col gap-4 animate-fade">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-display text-gold">{state.rank.title}</span>
              {state.rank.next && <span className="text-ink-dim">{state.rank.remaining?.toLocaleString("es-ES")} de {state.rank.metric.toLowerCase()} para {state.rank.next}</span>}
            </div>
            {state.rank.next && <StatBar value={state.rank.fraction * 100} max={100} color="var(--gold)" />}
          </div>
          <ul className="flex flex-col gap-2" data-testid="path-steps">
            {state.steps.map((s) => (
              <li key={s.id} className={`panel-sub p-3 flex items-start justify-between gap-3 ${s.urgent ? "border-blood/60" : ""}`} data-testid="path-step">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${s.urgent ? "text-blood" : "text-ink"}`}>{s.title}</p>
                  <p className="text-xs text-ink-dim mt-0.5">{s.detail}</p>
                </div>
                <button className="btn-ghost px-2 py-1 text-xs inline-flex items-center gap-1 shrink-0" onClick={() => go(s)} data-testid="path-step-go">
                  Ir <ArrowRight className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
