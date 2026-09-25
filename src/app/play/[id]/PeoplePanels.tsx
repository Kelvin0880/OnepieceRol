"use client";

import { useState } from "react";
import { Lock, Swords, Users } from "lucide-react";
import { FACTION_ACCENT, FACTION_LABEL } from "./labels";
import type { BattleSummary, Character, DuelResult, OtherHere, StateResponse } from "./types";

type Act = (body: Record<string, unknown>) => Promise<unknown>;

function Heading({ children, icon: Icon }: { children: React.ReactNode; icon: typeof Users }) {
  return (
    <h3 className="font-display text-sm text-ink-dim mb-2 flex items-center gap-2">
      <Icon className="w-4 h-4 text-gold" />
      {children}
    </h3>
  );
}

export function OthersHerePanel({ data, busy, onDuel }: { data: StateResponse; busy: boolean; onDuel: Act }) {
  const { character, duel } = data;
  const canChallenge = character.status === "ALIVE" && !duel && !character.pendingEncounter;
  return (
    <section className="panel p-4 animate-rise">
      <Heading icon={Users}>Aventureros en esta isla</Heading>
      <div className="flex flex-col divide-y divide-line">
        {data.othersHere.map((o) => (
          <div key={o.id} className="text-sm flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: FACTION_ACCENT[o.faction] ?? "var(--gold)" }} aria-hidden />
              <span className="truncate">{o.name}</span>
              <span className="text-ink-dim text-xs shrink-0">
                · Nv. {o.level} · {FACTION_LABEL[o.faction]}
              </span>
              {o.hostile && <span className="chip border-blood/60 text-[#f0907a]">hostil</span>}
            </span>
            <span className="flex items-center gap-2">
              {o.crew && <span className="text-xs text-gold">{o.crew.name}</span>}
              {canChallenge && (
                <>
                  <button className="btn-ghost px-2 py-0.5 text-xs" disabled={busy} onClick={() => onDuel({ op: "challenge", opponentId: o.id })}>
                    Retar a duelo
                  </button>
                  <button className="btn-danger px-2 py-0.5 text-xs" disabled={busy} onClick={() => onDuel({ op: "challenge", opponentId: o.id, lethal: true })}>
                    {o.hostile ? "Cazar a muerte" : "Duelo a muerte"}
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PrisonersHerePanel({ data, busy, error, onRescue }: { data: StateResponse; busy: boolean; error: string | null; onRescue: (id: string) => void }) {
  return (
    <section className="panel p-4 animate-rise">
      <Heading icon={Lock}>Prisioneros en esta isla</Heading>
      <div className="flex flex-col divide-y divide-line">
        {data.prisonersHere.map((p) => (
          <div key={p.id} className="text-sm flex items-center justify-between gap-2 py-2">
            <span>
              {p.name}{" "}
              <span className="text-ink-dim text-xs">
                · Nv. {p.level} · {FACTION_LABEL[p.faction]}
              </span>
            </span>
            <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => onRescue(p.id)}>
              Rescatar
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-blood text-xs mt-2">{error}</p>}
    </section>
  );
}

export function CrewChallengePanel({ data, busy, error, onBattle }: { data: StateResponse; busy: boolean; error: string | null; onBattle: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [challengeCrewId, setChallengeCrewId] = useState<string | null>(null);
  const [matchups, setMatchups] = useState<Record<string, string>>({});
  const [lethal, setLethal] = useState(false);
  const character: Character = data.character;
  if (!character.crew || character.crew.captainId !== character.id) return null;
  const rivalCrews = new Map<string, { id: string; name: string; members: OtherHere[] }>();
  for (const o of data.othersHere) {
    if (!o.crew || o.crew.id === character.crew.id) continue;
    const entry = rivalCrews.get(o.crew.id) ?? { id: o.crew.id, name: o.crew.name, members: [] };
    entry.members.push(o);
    rivalCrews.set(o.crew.id, entry);
  }
  if (rivalCrews.size === 0) return null;
  const myMembersHere = character.crew.members.filter((m) => m.currentIslandId === character.currentIsland.id && m.status === "ALIVE");
  const rival = challengeCrewId ? rivalCrews.get(challengeCrewId) : null;
  const rows = rival ? myMembersHere.slice(0, rival.members.length) : [];
  const chosen = new Set(Object.values(matchups));

  return (
    <section className="panel p-4 animate-rise">
      <Heading icon={Swords}>Desafiar a otra tripulación</Heading>
      {!rival ? (
        <div className="flex flex-wrap gap-2">
          {[...rivalCrews.values()].map((rc) => (
            <button key={rc.id} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setChallengeCrewId(rc.id)}>
              Desafiar a {rc.name} ({rc.members.length})
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((mine) => (
            <div key={mine.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 sm:w-32 truncate">{mine.name}</span>
              <span className="text-ink-dim">vs</span>
              <select className="field flex-1 min-w-0 px-2 py-1 text-xs" value={matchups[mine.id] ?? ""} onChange={(e) => setMatchups((m) => ({ ...m, [mine.id]: e.target.value }))}>
                <option value="">— elegir rival —</option>
                {rival.members
                  .filter((r) => r.id === matchups[mine.id] || !chosen.has(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Nv. {r.level})
                    </option>
                  ))}
              </select>
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs text-ink-dim mt-1">
            <input type="checkbox" checked={lethal} onChange={(e) => setLethal(e.target.checked)} data-testid="battle-lethal" />
            A muerte (el vencedor de cada duelo decide matar, capturar o perdonar; lo pactáis fuera del juego)
          </label>
          {error && <p className="text-blood text-xs">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              className="btn-gold px-3 py-1.5 text-xs"
              disabled={busy || rows.some((r) => !matchups[r.id])}
              onClick={async () => {
                const ok = await onBattle({ op: "propose", targetCrewId: rival.id, matchups: rows.map((r) => ({ myCharacterId: r.id, opponentCharacterId: matchups[r.id] })), lethal });
                if (ok) {
                  setChallengeCrewId(null);
                  setMatchups({});
                }
              }}
            >
              Proponer batalla
            </button>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setChallengeCrewId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function CrewBattlesPanel({ battles, busy, onBattle }: { battles: BattleSummary[]; busy: boolean; onBattle: (body: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <section className="panel p-4 animate-rise">
      <Heading icon={Swords}>Batallas de tripulación</Heading>
      <div className="flex flex-col gap-3">
        {battles.map((b) => {
          const result: { victor: "a" | "b" | "draw"; duels: DuelResult[] } | null = b.resultJson ? JSON.parse(b.resultJson) : null;
          const won = result && ((b.isChallenger && result.victor === "a") || (!b.isChallenger && result.victor === "b"));
          return (
            <div key={b.id} className="text-sm border-b border-line pb-2 last:border-0">
              <div className="flex flex-wrap justify-between gap-2">
                <span>
                  {b.isChallenger ? "Desafiaste a" : "Te desafió"} {b.opponentCrewName} ({b.matchupCount} vs {b.matchupCount})
                </span>
                <span className={b.status === "PROPOSED" || b.status === "ACTIVE" ? "text-gold" : b.status === "DECLINED" ? "text-ink-dim" : won ? "text-emerald-300" : "text-blood"}>
                  {b.status === "PROPOSED" ? "Pendiente" : b.status === "ACTIVE" ? "En curso: un duelo por pareja" : b.status === "DECLINED" ? "Rechazada" : won ? "Victoria" : "Derrota"}
                </span>
              </div>
              {b.status === "PROPOSED" && !b.isChallenger && (
                <div className="flex gap-2 mt-2">
                  <button className="btn-gold px-3 py-1 text-xs" disabled={busy} onClick={() => onBattle({ op: "respond", battleId: b.id, accept: true })}>
                    Aceptar
                  </button>
                  <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => onBattle({ op: "respond", battleId: b.id, accept: false })}>
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
