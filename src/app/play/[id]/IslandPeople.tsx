"use client";

import { useState } from "react";
import { Swords, Users } from "lucide-react";
import type { CanonHereState, IslandCastEntry } from "./types";

type Act = (body: Record<string, unknown>, path?: string) => Promise<void>;

const CATEGORY_LABEL: Record<string, string> = { guard: "Guardia", thug: "Matón", marine: "Marine", pirate: "Pirata", civilian: "Civil", merchant: "Comerciante", official: "Autoridad", other: "Vecino" };

/** Everyone you can meet where you stand: the canon characters in plain sight (ask them for a task or go against them) and the island's own people with their live state. */
export function IslandPeoplePanel({ canon, cast, islandName, act, busy, error, jointActive }: { canon: CanonHereState | null; cast: IslandCastEntry[]; islandName: string; act: Act; busy: boolean; error: string | null; jointActive: boolean }) {
  const hasCanon = !!canon && canon.actors.length > 0;
  const [tab, setTab] = useState<"canon" | "residents">(hasCanon ? "canon" : "residents");
  const [showDead, setShowDead] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const alive = cast.filter((c) => !c.dead);
  const dead = cast.filter((c) => c.dead);
  const ch = canon?.challenge ?? null;

  return (
    <section className="panel p-4 animate-rise" data-testid="island-people">
      <h3 className="font-display text-lg text-gold-bright flex items-center gap-2">
        <Users className="w-5 h-5 shrink-0" />
        <span>Gente de {islandName}</span>
      </h3>

      {ch && ch.stage === "READY" && (
        <div className="mt-3 rounded border-2 border-gold p-3" data-testid="canon-ready">
          <p className="text-sm text-gold-bright">Los que guardaban a {ch.actorName} han caído. Ahora puedes plantarle cara en persona.</p>
          {ch.msLeft != null && <p className="text-xs text-ink-dim mt-1">Te quedan {Math.max(1, Math.ceil(ch.msLeft / 3_600_000))} h para hacerlo.</p>}
          <button className="btn-gold px-3 py-1.5 text-xs mt-2" disabled={busy || jointActive} onClick={() => act({ op: "duel" }, "canon")} data-testid="canon-duel">
            Enfrentar a {ch.actorName}
          </button>
        </div>
      )}
      {ch && ch.stage === "WON" && (
        <div className="mt-3 rounded border-2 border-blood p-3" style={{ background: "rgba(120,20,20,0.15)" }} data-testid="canon-verdict">
          <p className="text-sm text-gold-bright">{ch.actorName} está a tu merced. ¿Qué haces con él?</p>
          <p className="text-xs text-ink-dim mt-1">Capturarlo o matarlo necesita la confirmación del administrador; perdonarlo es inmediato.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {(
              [
                ["capture", "Capturarlo"],
                ["death", "Matarlo"],
                ["spare", "Perdonarlo"],
              ] as const
            ).map(([choice, label]) => (
              <button key={choice} className={choice === "spare" ? "btn-gold px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"} disabled={busy} onClick={() => act({ op: "verdict", choice }, "canon")} data-testid={`canon-verdict-${choice}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {ch && ch.stage === "AWAITING_OWNER" && (
        <div className="mt-3 rounded border border-white/15 p-3" data-testid="canon-waiting">
          <p className="text-sm text-gold-bright">Esperando al administrador…</p>
          <p className="text-xs text-ink-dim mt-1">{ch.note ?? `El destino de ${ch.actorName} está en sus manos.`}</p>
        </div>
      )}
      {ch && (ch.stage === "VANGUARD" || ch.stage === "DUEL") && (
        <p className="text-xs text-ink-dim mt-3" data-testid="canon-fighting">{ch.stage === "VANGUARD" ? `Estás abriéndote paso hacia ${ch.actorName}.` : `Estás enfrentando a ${ch.actorName}.`}</p>
      )}

      <div className="flex gap-2 mt-3">
        {hasCanon && (
          <button onClick={() => setTab("canon")} className={`px-3 py-1 rounded-full text-xs border ${tab === "canon" ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`} data-testid="people-tab-canon">
            Personajes canon ({canon!.actors.length})
          </button>
        )}
        <button onClick={() => setTab("residents")} className={`px-3 py-1 rounded-full text-xs border ${tab === "residents" || !hasCanon ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`} data-testid="people-tab-residents">
          Habitantes ({alive.length})
        </button>
      </div>

      {tab === "canon" && hasCanon && (
        <ul className="flex flex-col gap-2 mt-3">
          {canon!.actors.map((a) => (
            <li key={a.id} className="rounded border border-white/10 p-2" data-testid="canon-actor">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-sm text-gold-bright">{a.name} <span className="text-xs text-ink-dim">({a.rank})</span></p>
                  <p className="text-xs text-ink-dim">{a.factionName} · poder {a.power}{a.personality ? ` · ${a.personality}` : ""}</p>
                  {a.openMission && <p className="text-xs text-emerald-300">Encargo en curso: {a.openMission}</p>}
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !!a.withBlock} title={a.withBlock ?? ""} onClick={() => act({ op: "mission", actorId: a.id }, "canon")} data-testid="canon-mission">
                    Pedirle un encargo
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1" disabled={busy || jointActive || !!a.againstBlock} title={a.againstBlock ?? ""} onClick={() => setConfirm(a.id)} data-testid="canon-challenge">
                    <Swords className="w-3.5 h-3.5" /> Desafiarlo
                  </button>
                </div>
              </div>
              {(a.withBlock || a.againstBlock) && (
                <p className="text-[11px] text-ink-dim mt-1">
                  {a.withBlock ? `Encargo: ${a.withBlock} ` : ""}
                  {a.againstBlock ? `Desafío: ${a.againstBlock}` : ""}
                </p>
              )}
              {confirm === a.id && (
                <div className="mt-2 rounded border border-blood p-2" data-testid="canon-challenge-confirm">
                  <p className="text-xs text-ink">Vas contra {a.name}. Primero tendrás que vencer a los suyos y después a él en persona; si pierdes, pagas el precio de cualquier derrota. Si ganas, decides su destino (capturar o matar necesita la confirmación del administrador).</p>
                  <div className="flex gap-2 mt-2">
                    <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => { setConfirm(null); void act({ op: "challenge", actorId: a.id }, "canon"); }} data-testid="canon-challenge-go">
                      Sí, desafiarlo
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirm(null)}>Mejor no</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          <li className="text-[11px] text-ink-dim">Solo aparecen los personajes que están a la vista en esta isla. A los Yonko se les desafía por su trono en el panel Poder.</li>
        </ul>
      )}

      {(tab === "residents" || !hasCanon) && (
        <div className="mt-3 flex flex-col gap-2" data-testid="island-residents">
          {alive.length === 0 && <p className="text-xs text-ink-dim">Nadie con nombre por aquí ahora mismo.</p>}
          {alive.map((r) => (
            <div key={r.id} className="rounded border border-white/10 p-2" data-testid="cast-entry">
              <div className="flex justify-between gap-2">
                <span className="text-sm">{r.name} <span className="text-xs text-ink-dim">· {r.title}</span></span>
                <span className={`text-[10px] uppercase tracking-wide shrink-0 ${r.usable ? "text-emerald-300" : "text-amber-300"}`} data-testid="cast-state">{r.state}</span>
              </div>
              <p className="text-[11px] text-ink-dim">{CATEGORY_LABEL[r.category] ?? r.category} · nivel {r.level}{r.fighter ? "" : " · no combate"} · {r.personality}</p>
              {r.memory.length > 0 && <p className="text-[11px] text-ink-dim italic">Recuerda: {r.memory.join(" · ")}</p>}
            </div>
          ))}
          {dead.length > 0 && (
            <button className="text-xs text-ink-dim underline self-start" onClick={() => setShowDead((v) => !v)}>{showDead ? "Ocultar fallecidos" : `Ver fallecidos (${dead.length})`}</button>
          )}
          {showDead && dead.map((r) => (
            <div key={r.id} className="rounded border border-white/10 p-2 opacity-60 text-xs">
              {r.name} · {r.title} — {r.diedNote ?? "muerto"}
            </div>
          ))}
          <p className="text-[11px] text-ink-dim">Solo estas personas existen aquí con nombre. También en el Códice → Habitantes.</p>
        </div>
      )}
      {error && <p className="text-blood text-xs mt-2">{error}</p>}
    </section>
  );
}
