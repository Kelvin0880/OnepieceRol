"use client";

import { useState } from "react";
import { ATTRIBUTE_KEYS, ATTRIBUTE_INFO, attributeCap, type AttributeKey } from "@/lib/engine/attributes";

interface Props {
  characterId: string;
  level: number;
  points: number;
  values: Record<AttributeKey, number>;
  onChanged: () => void;
}

export default function AttributesCard({ characterId, level, points, values, onChanged }: Props) {
  const [draft, setDraft] = useState<Partial<Record<AttributeKey, number>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spent = Object.values(draft).reduce((a, b) => a + (b ?? 0), 0);
  const left = points - spent;
  const cap = attributeCap(level);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/attributes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo repartir.");
      setDraft({});
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="attributes-card">
      {points > 0 && (
        <p className="text-xs text-gold-bright mb-2" data-testid="attr-points">
          ✦ Tienes {left} punto{left === 1 ? "" : "s"} de atributo por repartir (2 por cada nivel).
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {ATTRIBUTE_KEYS.map((k) => {
          const add = draft[k] ?? 0;
          return (
            <div key={k} className="flex items-center gap-2 text-sm" title={ATTRIBUTE_INFO[k].effect}>
              <span className="flex-1 min-w-0">
                {ATTRIBUTE_INFO[k].label}: <strong data-testid={`attr-${k}`}>{values[k] + add}</strong>
                {add > 0 && <span className="text-gold ml-1">(+{add})</span>}
              </span>
              {points > 0 && (
                <span className="flex gap-1 shrink-0">
                  <button className="btn-ghost px-2 py-0.5 text-xs" disabled={add <= 0 || busy} onClick={() => setDraft({ ...draft, [k]: add - 1 })} aria-label={`Quitar ${ATTRIBUTE_INFO[k].label}`}>
                    −
                  </button>
                  <button className="btn-ghost px-2 py-0.5 text-xs" disabled={left <= 0 || busy || values[k] + add >= cap} onClick={() => setDraft({ ...draft, [k]: add + 1 })} data-testid={`attr-plus-${k}`} aria-label={`Subir ${ATTRIBUTE_INFO[k].label}`}>
                    +
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="text-[11px] text-ink-dim mt-2 list-disc pl-4">
        {ATTRIBUTE_KEYS.map((k) => (
          <li key={k}>
            <span className="text-ink">{ATTRIBUTE_INFO[k].label}:</span> {ATTRIBUTE_INFO[k].effect}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-dim mt-1">Tope a nivel {level}: {cap} por atributo.</p>
      {spent > 0 && (
        <div className="flex gap-2 mt-2">
          <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={confirm} data-testid="attr-confirm">
            Confirmar reparto
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setDraft({})}>
            Deshacer
          </button>
        </div>
      )}
      {error && (
        <p className="text-xs text-blood mt-1" data-testid="attr-error">
          {error}
        </p>
      )}
    </div>
  );
}
