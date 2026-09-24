"use client";

import { useCallback, useEffect, useState } from "react";

interface Known {
  id: string;
  name: string;
  category: string;
  description: string;
  mastery: number;
  tier: string;
  nextTierAt: number | null;
  weaponsNeeded: { min: number; max: number };
  applies: boolean;
  techniques: { name: string; note: string; cost: number; minMastery: number; unlocked: boolean }[];
  trainReadyInMs: number;
}
interface View {
  islandName: string;
  focusId: string | null;
  wielded: number;
  known: Known[];
  teachable: { id: string; name: string; category: string; description: string; price: number; minLevel: number; canLearn: boolean; reason: string | null }[];
  elsewhere: { id: string; name: string; category: string; islands: string[]; factions: string[] | null; minLevel: number; price: number }[];
  weapons: { id: string; name: string; kind: string; atkBonus: number; equipped: boolean; wielded: boolean }[];
}

type Tab = "mine" | "learn" | "map";

const FACTION_LABEL: Record<string, string> = { PIRATE: "Pirata", MARINE: "Marina", REVOLUTIONARY: "Revolucionario", BOUNTY_HUNTER: "Cazarrecompensas", CP0: "CP-0" };

function weaponsText(w: { min: number; max: number }): string {
  if (w.max === 0) return "sin armas";
  if (w.min === w.max) return `${w.min} arma${w.min > 1 ? "s" : ""}`;
  return "cualquier número de armas";
}

export default function StylesPanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/styles`);
    if (res.ok) setView(await res.json());
  }, [characterId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function act(body: unknown) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/styles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose} data-testid="styles-panel">
      <div className="panel p-4 w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-3 [&>*]:shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl text-gold-bright">Estilos de combate</h3>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["mine", "Mis estilos"],
              ["learn", "Aprender aquí"],
              ["map", "Dónde aprender"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} className={tab === id ? "btn-gold px-3 py-1.5 text-sm" : "btn-ghost px-3 py-1.5 text-sm"} onClick={() => setTab(id)} data-testid={`styles-tab-${id}`}>
              {label}
            </button>
          ))}
        </div>
        {notice && (
          <p className="text-sm text-gold" data-testid="styles-notice">
            {notice}
          </p>
        )}
        {error && (
          <p className="text-sm text-blood" data-testid="styles-error">
            {error}
          </p>
        )}

        {view && tab === "mine" && (
          <div className="flex flex-col gap-3">
            <section className="rounded border border-white/10 p-2" data-testid="styles-hands">
              <h4 className="font-display text-sm text-ink-dim mb-1">En tus manos ({view.wielded}/3)</h4>
              <p className="text-xs text-ink-dim mb-1">Con un estilo de varias espadas (Nitoryu, Santoryu) las armas extra rinden casi igual que la principal; sin él, las armas de más son torpes.</p>
              {view.weapons.length === 0 && <p className="text-xs text-ink-dim">Sin armas.</p>}
              {view.weapons.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm min-w-0">
                    {w.name} <span className="text-[11px] text-ink-dim">+{w.atkBonus} ATQ</span>
                  </span>
                  {w.equipped ? (
                    <span className="text-xs text-gold shrink-0">Principal</span>
                  ) : (
                    <button className="btn-ghost px-3 py-1 text-xs shrink-0" disabled={busy} onClick={() => act({ op: "wield", weaponId: w.id, wield: !w.wielded })} data-testid={`wield-${w.id}`}>
                      {w.wielded ? "Guardar" : "Empuñar también"}
                    </button>
                  )}
                </div>
              ))}
            </section>

            {view.known.length === 0 && <p className="text-sm text-ink-dim">Todavía no conoces ningún estilo. Mira «Aprender aquí» o «Dónde aprender»: cada isla enseña algo distinto y tu facción abre unas puertas y cierra otras.</p>}
            {view.known.map((k) => (
              <div key={k.id} className="rounded border border-white/10 p-2 flex flex-col gap-1" data-testid={`style-${k.id}`}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-sm text-gold-bright">
                    {k.name}
                    {view.focusId === k.id && <span className="ml-2 text-[11px] text-gold">★ principal</span>}
                  </span>
                  <span className="text-[11px] text-ink-dim">
                    {k.category} · {weaponsText(k.weaponsNeeded)}
                  </span>
                </div>
                <p className="text-xs text-ink-dim">{k.description}</p>
                <div>
                  <div className="flex justify-between text-[11px] text-ink-dim mb-0.5">
                    <span data-testid={`style-tier-${k.id}`}>{k.tier}</span>
                    <span>
                      {k.mastery}/100{k.nextTierAt ? ` · siguiente rango a ${k.nextTierAt}` : ""}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-black/30 overflow-hidden">
                    <div className="h-full" style={{ width: `${k.mastery}%`, background: "var(--gold)" }} />
                  </div>
                </div>
                {!k.applies && <p className="text-xs text-blood">Ahora no funciona: pide {weaponsText(k.weaponsNeeded)} en las manos y llevas {view.wielded}.</p>}
                <ul className="text-[11px] text-ink-dim list-none flex flex-col gap-0.5">
                  {k.techniques.map((t) => (
                    <li key={t.name} className={t.unlocked ? "text-ink" : "opacity-60"}>
                      {t.unlocked ? "✦" : "🔒"} {t.name} <span className="text-ink-dim">— {t.note}{t.unlocked ? ` (aguante ${t.cost})` : ` (maestría ${t.minMastery})`}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-gold px-3 py-1 text-xs" disabled={busy || k.mastery >= 100 || k.trainReadyInMs > 0} onClick={() => act({ op: "train", styleId: k.id })} data-testid={`style-train-${k.id}`}>
                    {k.trainReadyInMs > 0 ? `Entrenar (en ${Math.ceil(k.trainReadyInMs / 60000)} min)` : "Entrenar"}
                  </button>
                  <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => act({ op: "focus", styleId: view.focusId === k.id ? null : k.id })}>
                    {view.focusId === k.id ? "Quitar como principal" : "Usar como principal"}
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-ink-dim">En combate, escribe el nombre del estilo o de una técnica («uso Oni Giri», «lanzo un Rankyaku») para usarla: gasta aguante y suma poder. También ganas maestría usándolo.</p>
          </div>
        )}

        {view && tab === "learn" && (
          <div className="flex flex-col gap-2" data-testid="styles-teachable">
            <p className="text-xs text-ink-dim">Escuelas en {view.islandName}:</p>
            {view.teachable.length === 0 && <p className="text-sm text-ink-dim">Aquí nadie enseña nada nuevo para ti. Mira «Dónde aprender».</p>}
            {view.teachable.map((t) => (
              <div key={t.id} className="rounded border border-white/10 p-2 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-sm text-gold-bright">{t.name}</span>
                  <span className="text-[11px] text-ink-dim">
                    {t.category} · nivel {t.minLevel} · ฿ {t.price.toLocaleString("es-ES")}
                  </span>
                </div>
                <p className="text-xs text-ink-dim">{t.description}</p>
                {t.reason && <p className="text-xs text-blood">{t.reason}</p>}
                <div>
                  <button className="btn-gold px-3 py-1 text-xs" disabled={busy || !t.canLearn} onClick={() => act({ op: "learn", styleId: t.id })} data-testid={`style-learn-${t.id}`}>
                    Aprender
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {view && tab === "map" && (
          <div className="flex flex-col gap-2" data-testid="styles-map">
            <p className="text-xs text-ink-dim">Qué estilos se aprenden en otras islas (y qué facciones los aceptan).</p>
            {view.elsewhere.map((e) => (
              <div key={e.id} className="rounded border border-white/10 p-2">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-sm text-gold-bright">{e.name}</span>
                  <span className="text-[11px] text-ink-dim">{e.category} · nivel {e.minLevel}</span>
                </div>
                <p className="text-xs text-ink-dim">
                  Se enseña en: {e.islands.join(", ")} · {e.factions ? `solo ${e.factions.map((f) => FACTION_LABEL[f] ?? f).join(" / ")}` : "cualquier facción"} · ฿ {e.price.toLocaleString("es-ES")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
