"use client";

import { useCallback, useEffect, useState } from "react";

interface Overview {
  stats: { users: number; alive: number; dead: number; prisoners: number; online: number; crews: number; openArcs: number; newsLast24h: number };
  reports: { id: string; author: string; text: string; at: string }[];
  errors: { id: string; context: string; message: string; at: string }[];
  events: { id: string; title: string; islandName: string; status: string; rewardText: string; winnerName: string | null; createdBy: string; entries: { name: string; isNpc: boolean; status: string }[] }[];
  islands: string[];
  actors: { name: string; status: string; role: string; factionName: string }[];
  characters: { name: string; level: number }[];
}

function IslandSelect({ value, onChange, islands }: { value: string; onChange: (v: string) => void; islands: string[] }) {
  return (
    <select className={`${field} sm:w-56`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Isla: cualquiera</option>
      {islands.map((i) => <option key={i} value={i}>{i}</option>)}
    </select>
  );
}

function ActorSelect({ label, value, onChange, actors }: { label: string; value: string; onChange: (v: string) => void; actors: { name: string; factionName: string; status: string }[] }) {
  const groups = [...new Set(actors.map((a) => a.factionName))].sort();
  return (
    <select className={`${field} sm:w-64`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {actors.filter((a) => a.factionName === g).map((a) => <option key={a.name} value={a.name}>{a.name}{a.status !== "ACTIVE" ? " (derrotado)" : ""}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

const field = "w-full text-sm bg-transparent border border-[--line] rounded px-3 py-2";

/** Owner-only tools: dashboard, player reports, events, ideas for the AI and official announcements. */
export default function AdminTools() {
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ annHead: "", annBody: "", idea: "", island: "", evIdea: "", evIsland: "", evMax: "10", evFruit: "auto", arcT: "", arcA: "", arcKind: "capture" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tools");
    if (res.ok) setO(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "No se pudo completar.");
      else setNotice(ok + (d.title ? `: «${d.title}»` : ""));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!o) return null;
  const islands = (
    <datalist id="admin-islands">
      {o.islands.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );

  return (
    <div className="flex flex-col gap-5" data-testid="admin-tools">
      {islands}
      {notice && <p className="text-gold text-sm" data-testid="admin-tools-notice">{notice}</p>}
      {error && <p className="text-blood text-sm" data-testid="admin-tools-error">{error}</p>}

      <section className="panel p-4" data-testid="admin-stats">
        <h2 className="font-display text-lg text-gold-bright mb-2">Resumen del mundo</h2>
        <p className="text-sm">
          {o.stats.users} cuentas · {o.stats.alive} personajes vivos · {o.stats.dead} muertos · {o.stats.prisoners} presos · <strong>{o.stats.online} conectados ahora</strong> · {o.stats.crews} tripulaciones · {o.stats.openArcs} eventos mundiales abiertos · {o.stats.newsLast24h} noticias en 24 h
        </p>
      </section>

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-reports">
        <h2 className="font-display text-lg text-gold-bright">Reportes de jugadores</h2>
        {o.reports.length === 0 && <p className="text-sm text-ink-dim">No hay reportes.</p>}
        {o.reports.map((r) => (
          <div key={r.id} className="border border-[--line] rounded p-2 text-sm flex flex-col gap-1" data-testid="admin-report">
            <div className="text-xs text-ink-dim">
              {r.author} · {new Date(r.at).toLocaleString("es-ES")}
            </div>
            <p className="whitespace-pre-line">{r.text}</p>
            <button className="btn-ghost px-2 py-1 text-xs self-start" disabled={busy} onClick={() => run({ op: "dismiss_report", id: r.id }, "Reporte archivado")}>
              Archivar
            </button>
          </div>
        ))}
      </section>

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-events">
        <h2 className="font-display text-lg text-gold-bright">Eventos para principiantes</h2>
        <p className="text-xs text-ink-dim">La IA inventa la prueba y sus rivales; el premio lo fija el sistema. Sale en las noticias. Deja la idea en blanco para que invente todo.</p>
        <input className={field} placeholder="Idea opcional (ej.: una carrera de barcas con premio)" value={f.evIdea} onChange={(e) => set("evIdea", e.target.value)} data-testid="admin-event-idea" />
        <div className="flex flex-wrap gap-2">
          <IslandSelect value={f.evIsland} onChange={(v) => set("evIsland", v)} islands={o.islands} />
          <input className={`${field} w-28`} type="number" min={1} max={60} value={f.evMax} onChange={(e) => set("evMax", e.target.value)} title="Nivel máximo" />
          <select className={`${field} w-44`} value={f.evFruit} onChange={(e) => set("evFruit", e.target.value)}>
            <option value="auto">Fruta: a criterio del sistema</option>
            <option value="yes">Con fruta única</option>
            <option value="no">Sin fruta</option>
          </select>
          <button
            className="btn-gold px-3 py-2 text-sm"
            disabled={busy}
            data-testid="admin-event-create"
            onClick={() => run({ op: "create_event", idea: f.evIdea || null, island: f.evIsland || null, maxLevel: Number(f.evMax) || 10, withFruit: f.evFruit === "auto" ? null : f.evFruit === "yes" }, "Evento anunciado")}
          >
            Anunciar evento
          </button>
        </div>
        {o.events.map((e) => (
          <div key={e.id} className="border border-[--line] rounded p-2 text-sm flex flex-col gap-1" data-testid="admin-event">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{e.title}</strong>
              <span className="text-xs text-ink-dim">
                {e.islandName} · {e.status}
                {e.winnerName ? ` · ganó ${e.winnerName}` : ""}
              </span>
            </div>
            <p className="text-xs text-ink-dim">
              Premio: {e.rewardText} · Inscritos: {e.entries.filter((x) => x.status !== "WITHDRAWN").map((x) => `${x.name}${x.isNpc ? " (NPC)" : ""}${x.status === "SUBMITTED" ? " ✓" : ""}`).join(", ")}
            </p>
            {e.status === "OPEN" && (
              <div className="flex gap-2">
                <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => run({ op: "force_event", eventId: e.id }, "Evento cerrado y juzgado")}>
                  Cerrar ya (los que no enviaron se retiran)
                </button>
                <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => run({ op: "cancel_event", eventId: e.id }, "Evento cancelado")}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-happening">
        <h2 className="font-display text-lg text-gold-bright">Proponer un suceso a la IA</h2>
        <p className="text-xs text-ink-dim">Escribe una idea y la IA la desarrolla como noticia en el mundo (o pulsa sin idea para que invente uno ahora). No puede matar ni capturar a personajes canon.</p>
        <textarea className={`${field} min-h-16`} placeholder="Idea (ej.: una tormenta de arena descubre unas ruinas en Alabasta)" value={f.idea} onChange={(e) => set("idea", e.target.value)} data-testid="admin-happening-idea" />
        <div className="flex flex-wrap gap-2">
          <IslandSelect value={f.island} onChange={(v) => set("island", v)} islands={o.islands} />
          <button className="btn-gold px-3 py-2 text-sm" disabled={busy} data-testid="admin-happening-go" onClick={() => run({ op: "propose_happening", idea: f.idea || null, island: f.island || null }, "Suceso publicado en las noticias")}>
            Publicar suceso
          </button>
        </div>
      </section>

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-announce">
        <h2 className="font-display text-lg text-gold-bright">Anuncio oficial</h2>
        <input className={field} placeholder="Titular" value={f.annHead} onChange={(e) => set("annHead", e.target.value)} data-testid="admin-announce-head" />
        <textarea className={`${field} min-h-20`} placeholder="Texto (sale tal cual en las noticias)" value={f.annBody} onChange={(e) => set("annBody", e.target.value)} data-testid="admin-announce-body" />
        <button className="btn-gold px-3 py-2 text-sm self-start" disabled={busy} data-testid="admin-announce-go" onClick={() => run({ op: "announce", headline: f.annHead, body: f.annBody }, "Anuncio publicado")}>
          Publicar anuncio
        </button>
      </section>

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-start-arc">
        <h2 className="font-display text-lg text-gold-bright">Iniciar un evento mundial</h2>
        <p className="text-xs text-ink-dim">Una historia de 6 capítulos entre dos personajes canon (nombre exacto del códice). Al final decides tú si el desenlace es definitivo.</p>
        <div className="flex flex-wrap gap-2">
          <ActorSelect label="Objetivo…" value={f.arcT} onChange={(v) => set("arcT", v)} actors={o.actors.filter((a) => a.status === "ACTIVE")} />
          <ActorSelect label="Agresor…" value={f.arcA} onChange={(v) => set("arcA", v)} actors={o.actors.filter((a) => a.status === "ACTIVE" || (f.arcKind === "reclaim" && a.status === "DEFEATED"))} />
          <select className={`${field} w-40`} value={f.arcKind} onChange={(e) => set("arcKind", e.target.value)}>
            <option value="capture">Captura</option>
            <option value="death">Muerte</option>
            <option value="reclaim">Recuperar el título de Yonko</option>
          </select>
          <button className="btn-gold px-3 py-2 text-sm" disabled={busy} data-testid="admin-start-arc-go" onClick={() => run({ op: "start_arc", target: f.arcT, aggressor: f.arcA, kind: f.arcKind }, "Evento mundial iniciado")}>
            Iniciar
          </button>
        </div>
      </section>

      <section className="panel p-4 flex flex-col gap-1" data-testid="admin-errors">
        <h2 className="font-display text-lg text-gold-bright">Errores recientes del servidor</h2>
        {o.errors.length === 0 && <p className="text-sm text-ink-dim">Sin errores registrados.</p>}
        {o.errors.map((e) => (
          <p key={e.id} className="text-xs text-ink-dim">
            {new Date(e.at).toLocaleString("es-ES")} · <span className="text-ink">{e.context}</span> — {e.message}
          </p>
        ))}
      </section>
    </div>
  );
}
