"use client";

import { useEffect, useMemo, useState } from "react";

interface Resident {
  id: string;
  name: string;
  island: string;
  title: string;
  category: string;
  level: number;
  description: string;
  personality: string;
  weapon: string | null;
  abilities: string[];
  memory: string[];
  status: string;
  state: string;
  usable: boolean;
  diedNote: string | null;
  generation: number;
}

export default function ResidentsSection() {
  const [rows, setRows] = useState<Resident[] | null>(null);
  const [q, setQ] = useState("");
  const [dead, setDead] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/codex/residents")
        .then((r) => r.json())
        .then((d) => setRows(d.residents))
        .catch(() => setRows([]));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const byIsland = useMemo(() => {
    const s = q.trim().toLowerCase();
    const shown = (rows ?? []).filter((r) => (dead ? r.status === "DEAD" : r.status !== "DEAD") && (!s || r.name.toLowerCase().includes(s) || r.island.toLowerCase().includes(s) || r.title.toLowerCase().includes(s)));
    const m = new Map<string, Resident[]>();
    for (const r of shown) m.set(r.island, [...(m.get(r.island) ?? []), r]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, q, dead]);

  return (
    <div className="flex flex-col gap-3" data-testid="residents-section">
      <p className="text-sm text-ink-dim">
        La gente de relleno de cada isla: los únicos personajes con nombre, además del canon, que el narrador puede usar. Su estado cambia en tiempo real: libres, peleando con alguien, heridos, detenidos o muertos (a un muerto lo sustituye otro con el tiempo).
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => setDead((v) => !v)} className={`px-3 py-1 rounded-full text-xs border ${dead ? "border-blood text-blood" : "border-white/15 text-ink-dim"}`} data-testid="residents-dead">
          {dead ? "Viendo fallecidos" : "Ver fallecidos"}
        </button>
        <input className="input ml-auto w-56" placeholder="Buscar por nombre, isla u oficio…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="residents-search" />
      </div>
      {rows === null ? (
        <p className="text-ink-dim">Cargando…</p>
      ) : byIsland.length === 0 ? (
        <p className="text-ink-dim">Nadie coincide con ese filtro.</p>
      ) : (
        byIsland.map(([island, list]) => (
          <div key={island} className="panel p-3 flex flex-col gap-2" data-testid="residents-island">
            <h3 className="font-display text-gold-bright">
              {island} <span className="text-xs text-ink-dim">({list.length})</span>
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {list.map((r) => (
                <div key={r.id} className={`border border-white/10 rounded p-2 text-sm ${r.status === "DEAD" ? "opacity-60" : ""}`} data-testid="resident-card">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className={`text-[10px] uppercase tracking-wide ${r.usable ? "text-emerald-300" : r.status === "DEAD" ? "text-blood" : "text-amber-300"}`} data-testid="resident-state">
                      {r.state}
                    </span>
                  </div>
                  <div className="text-xs text-ink-dim">
                    {r.title} · nivel {r.level}
                    {r.generation > 1 ? ` · sucesor nº ${r.generation - 1}` : ""}
                  </div>
                  <p className="text-xs mt-1">{r.description}</p>
                  <p className="text-xs text-ink-dim italic mt-1">{r.personality}</p>
                  {r.memory.length > 0 && <p className="text-[11px] text-ink-dim mt-1">Recuerda: {r.memory.join(" · ")}</p>}
                  {r.diedNote && <p className="text-[11px] text-blood mt-1">{r.diedNote}</p>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
