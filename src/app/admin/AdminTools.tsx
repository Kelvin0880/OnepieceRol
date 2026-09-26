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
  wars: { id: string; kind: string; status: string; attackerName: string; defenderName: string; attackerKind: string; defenderKind: string; attackerScore: number; defenderScore: number; nextFrontAt: string | null; startedAt: string; outcome: string | null }[];
  seatChallenges: { id: string; seat: string; status: string; challengerName: string; defenderName: string; expiresAt: string | null; resolveAt: string | null }[];
  itemIds: string[];
}

const ADJUSTABLE_FIELD_LABEL: Record<string, string> = { level: "Nivel", berries: "Berries", bounty: "Recompensa", notoriety: "Notoriedad", hp: "Vida", ancientScript: "Lengua antigua", attributePoints: "Puntos de atributo" };

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

function CharacterSelect({ value, onChange, characters, label = "Personaje…", testId }: { value: string; onChange: (v: string) => void; characters: { name: string; level: number }[]; label?: string; testId?: string }) {
  return (
    <select className={`${field} sm:w-56`} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
      <option value="">{label}</option>
      {characters.map((c) => <option key={c.name} value={c.name}>{c.name} (nv. {c.level})</option>)}
    </select>
  );
}

const field = "w-full text-sm bg-transparent border border-line rounded px-3 py-2";

/** Owner-only tools: dashboard, player reports, events, ideas for the AI and official announcements. */
export default function AdminTools() {
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    annHead: "", annBody: "", idea: "", island: "", evIdea: "", evIsland: "", evMax: "10", evFruit: "auto", arcT: "", arcA: "", arcKind: "capture", dispAdm: "", dispIsland: "", dispMin: "",
    adjName: "", adjField: "level", adjValue: "", tpName: "", tpIsland: "", healName: "", releaseName: "", ctrlIsland: "", ctrlValue: "", giveName: "", giveItem: "", giveFruitName: "", giveFruitTo: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tools");
    if (res.ok) setO(await res.json());
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <div key={r.id} className="border border-line rounded p-2 text-sm flex flex-col gap-1" data-testid="admin-report">
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
          <div key={e.id} className="border border-line rounded p-2 text-sm flex flex-col gap-1" data-testid="admin-event">
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

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-dispatch">
        <h2 className="font-display text-lg text-gold-bright">Enviar a un almirante</h2>
        <p className="text-xs text-ink-dim">La Marina manda a un almirante contra los piratas (nivel 2+) de una isla. Llega tras el tiempo indicado (por defecto 20–60 min según la distancia); quien se quede lo enfrenta sin escape y los derrotados son capturados. Nunca ataca islas de inicio, revolucionarias ni piratas. Deja los campos vacíos para que lo elija el sistema.</p>
        <div className="flex flex-wrap gap-2">
          <ActorSelect label="Almirante: cualquiera libre" value={f.dispAdm} onChange={(v) => set("dispAdm", v)} actors={o.actors.filter((a) => a.status === "ACTIVE" && a.role === "ADMIRAL")} />
          <IslandSelect value={f.dispIsland} onChange={(v) => set("dispIsland", v)} islands={o.islands} />
          <input className={`${field} w-32`} type="number" min={1} max={240} placeholder="Minutos" value={f.dispMin} onChange={(e) => set("dispMin", e.target.value)} />
          <button className="btn-gold px-3 py-2 text-sm" disabled={busy} data-testid="admin-dispatch-go" onClick={() => run({ op: "start_dispatch", admiral: f.dispAdm || null, island: f.dispIsland || null, minutes: f.dispMin ? Number(f.dispMin) : null }, "Almirante en camino")}>
            Enviar
          </button>
        </div>
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

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-wars">
        <h2 className="font-display text-lg text-gold-bright">Guerras del mundo</h2>
        <p className="text-xs text-ink-dim">Revolución, Justicia, Emperador y Marina: una guerra canon se declara sola cada pocos días. Aquí puedes forzar una ahora, correr un frente ya mismo o cerrar una en tablas si se atasca.</p>
        <button className="btn-gold px-3 py-2 text-sm self-start" disabled={busy} data-testid="admin-war-start" onClick={() => run({ op: "start_canon_war" }, "Guerra declarada")}>
          Forzar una guerra canon ahora
        </button>
        {o.wars.length === 0 && <p className="text-sm text-ink-dim">No hay guerras registradas.</p>}
        {o.wars.map((w) => (
          <div key={w.id} className="border border-line rounded p-2 text-sm flex flex-col gap-1" data-testid="admin-war">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{w.attackerName} ({w.attackerScore}) vs {w.defenderName} ({w.defenderScore})</strong>
              <span className="text-xs text-ink-dim">{w.kind} · {w.status}{w.outcome ? ` · ${w.outcome}` : ""}</span>
            </div>
            {w.status === "ACTIVE" && (
              <div className="flex gap-2">
                <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => run({ op: "run_war_front", warId: w.id }, "Frente resuelto")}>
                  Correr un frente ahora
                </button>
                <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => run({ op: "end_war", warId: w.id }, "Guerra terminada en tablas")}>
                  Forzar el final (tablas)
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="panel p-4 flex flex-col gap-2" data-testid="admin-seats">
        <h2 className="font-display text-lg text-gold-bright">Puestos de mando</h2>
        <p className="text-xs text-ink-dim">Almirantes, mando revolucionario y Gorosei se ganan desafiando a quien los ocupa. Aquí puedes forzar que el mundo desafíe un puesto ahora, o resolver ya un duelo canon anunciado.</p>
        <button className="btn-gold px-3 py-2 text-sm self-start" disabled={busy} data-testid="admin-seat-start" onClick={() => run({ op: "start_seat_event" }, "Desafío de puesto lanzado")}>
          Forzar un desafío de puesto ahora
        </button>
        {o.seatChallenges.length === 0 && <p className="text-sm text-ink-dim">No hay desafíos abiertos.</p>}
        {o.seatChallenges.map((c) => (
          <div key={c.id} className="border border-line rounded p-2 text-sm flex flex-col gap-1" data-testid="admin-seat-challenge">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{c.challengerName} desafía a {c.defenderName}</strong>
              <span className="text-xs text-ink-dim">{c.seat} · {c.status}</span>
            </div>
            {c.status === "ANNOUNCED" && (
              <button className="btn-ghost px-2 py-1 text-xs self-start" disabled={busy} onClick={() => run({ op: "resolve_seat_duel", challengeId: c.id }, "Duelo resuelto")}>
                Resolver ya el duelo
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="panel p-4 flex flex-col gap-3" data-testid="admin-player-tools">
        <h2 className="font-display text-lg text-gold-bright">Caja de herramientas del jugador</h2>
        <p className="text-xs text-ink-dim">Ajustes directos para soporte o pruebas: usa el nombre exacto del personaje.</p>

        <div className="flex flex-wrap items-center gap-2">
          <CharacterSelect value={f.adjName} onChange={(v) => set("adjName", v)} characters={o.characters} testId="admin-adjust-name" />
          <select className={`${field} sm:w-40`} value={f.adjField} onChange={(e) => set("adjField", e.target.value)}>
            {Object.entries(ADJUSTABLE_FIELD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className={`${field} sm:w-32`} type="number" placeholder="Valor" value={f.adjValue} onChange={(e) => set("adjValue", e.target.value)} data-testid="admin-adjust-value" />
          <button
            className="btn-gold px-3 py-2 text-sm"
            disabled={busy || !f.adjName || f.adjValue === ""}
            data-testid="admin-adjust-go"
            onClick={() => run({ op: "adjust_character", name: f.adjName, field: f.adjField, value: Number(f.adjValue) }, "Ajustado")}
          >
            Ajustar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CharacterSelect value={f.tpName} onChange={(v) => set("tpName", v)} characters={o.characters} testId="admin-teleport-name" />
          <IslandSelect value={f.tpIsland} onChange={(v) => set("tpIsland", v)} islands={o.islands} />
          <button className="btn-gold px-3 py-2 text-sm" disabled={busy || !f.tpName || !f.tpIsland} data-testid="admin-teleport-go" onClick={() => run({ op: "teleport", name: f.tpName, island: f.tpIsland }, "Teletransportado")}>
            Teletransportar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CharacterSelect value={f.healName} onChange={(v) => set("healName", v)} characters={o.characters} testId="admin-heal-name" />
          <button className="btn-ghost px-3 py-2 text-sm" disabled={busy || !f.healName} data-testid="admin-heal-go" onClick={() => run({ op: "heal", name: f.healName }, "Curado")}>
            Curar del todo
          </button>
          <CharacterSelect value={f.releaseName} onChange={(v) => set("releaseName", v)} characters={o.characters} label="Preso a liberar…" testId="admin-release-name" />
          <button className="btn-ghost px-3 py-2 text-sm" disabled={busy || !f.releaseName} data-testid="admin-release-go" onClick={() => run({ op: "release_prisoner", name: f.releaseName }, "Liberado")}>
            Liberar de la prisión
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IslandSelect value={f.ctrlIsland} onChange={(v) => set("ctrlIsland", v)} islands={o.islands} />
          <input className={`${field} sm:w-56`} placeholder="Controla: (vacío = nadie)" value={f.ctrlValue} onChange={(e) => set("ctrlValue", e.target.value)} data-testid="admin-control-value" />
          <button
            className="btn-gold px-3 py-2 text-sm"
            disabled={busy || !f.ctrlIsland}
            data-testid="admin-control-go"
            onClick={() => run({ op: "set_island_control", island: f.ctrlIsland, control: f.ctrlValue || null }, "Control de isla actualizado")}
          >
            Fijar control de la isla
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CharacterSelect value={f.giveName} onChange={(v) => set("giveName", v)} characters={o.characters} testId="admin-give-item-name" />
          <input className={`${field} sm:w-56`} list="admin-items" placeholder="id de objeto (ver lista)" value={f.giveItem} onChange={(e) => set("giveItem", e.target.value)} data-testid="admin-give-item-id" />
          <datalist id="admin-items">
            {o.itemIds.map((id) => <option key={id} value={id} />)}
          </datalist>
          <button className="btn-ghost px-3 py-2 text-sm" disabled={busy || !f.giveName || !f.giveItem} data-testid="admin-give-item-go" onClick={() => run({ op: "give_item", name: f.giveName, itemId: f.giveItem }, "Objeto entregado")}>
            Dar objeto
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CharacterSelect value={f.giveFruitTo} onChange={(v) => set("giveFruitTo", v)} characters={o.characters} testId="admin-give-fruit-to" />
          <input className={`${field} sm:w-56`} placeholder="Nombre exacto de la fruta" value={f.giveFruitName} onChange={(e) => set("giveFruitName", e.target.value)} data-testid="admin-give-fruit-name" />
          <button
            className="btn-ghost px-3 py-2 text-sm"
            disabled={busy || !f.giveFruitTo || !f.giveFruitName}
            data-testid="admin-give-fruit-go"
            onClick={() => run({ op: "give_fruit", name: f.giveFruitTo, fruitName: f.giveFruitName }, "Fruta entregada")}
          >
            Dar fruta (no singleton)
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
